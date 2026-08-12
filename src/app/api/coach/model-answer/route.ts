import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

import { getCurrentUser } from "@/lib/supabase/server";
import { UsageCollector, type OpenAIUsage } from "@/lib/api/token-usage";
import { getCoachAnswer, saveCoachAnswer } from "@/lib/db/coach-answers";
import {
  isRoundType,
  ROUND_RUBRIC_LABELS,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
import { badRequest, handleRouteError, unauthorized } from "@/lib/api/errors";
import { isTechnicalRound } from "@/lib/round-types";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseBoundedString } from "@/lib/api/query";
import {
  MAX_COACH_ANSWER_CHARS,
  MAX_COACH_QUESTION_CHARS,
} from "@/lib/api/input-limits";

export const runtime = "nodejs";

const MODEL = process.env.COACH_MODEL ?? "gpt-4o-mini";

/**
 * Output cap.
 *
 * Was 700, which was too tight for what the prompt asks for: a 4-8 sentence
 * model answer, plus a full rewrite of the candidate's answer, plus four tips —
 * roughly 550-710 tokens of JSON at the top end. Sitting on the boundary meant
 * occasional truncation, and because there was no `finish_reason` check it
 * surfaced as an unparseable-JSON error with no indication of the real cause.
 */
const COACH_MAX_TOKENS = 1000;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface ModelAnswerResult {
  modelAnswer: string;
  rewrite: string;
  tips: string[];
}

function rubricGuidance(roundType: InterviewRoundType | undefined): string {
  if (isTechnicalRound(roundType) && roundType) {
    return `This is a ${ROUND_RUBRIC_LABELS[roundType]} question. A strong answer is structured: clarify the problem, state assumptions, reason through tradeoffs out loud, and land on a concrete approach with complexity/impact.`;
  }
  return "This is a behavioral question. A strong answer uses the STAR structure (Situation, Task, Action, Result) with a specific, first-person example and a quantified outcome.";
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(`coach:${user.id}`, RATE_LIMITS.coach);
    if (limited) return limited;

    const body = await readJsonBody<Record<string, unknown>>(request);
    const question =
      parseBoundedString(body.question, {
        field: "question",
        max: MAX_COACH_QUESTION_CHARS,
      }) ?? "";
    const answer =
      parseBoundedString(body.answer, {
        field: "answer",
        max: MAX_COACH_ANSWER_CHARS,
      }) ?? "";
    // `roundType` selects the scoring rubric, so a garbage value silently
    // changes how the answer is graded. Validate rather than cast.
    const roundType = isRoundType(body.roundType) ? body.roundType : undefined;

    // Optional: the report page sends both so the result can be cached against
    // the turn. The drills page has no session and sends neither.
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : null;
    const turnIndex =
      typeof body.turnIndex === "number" && Number.isInteger(body.turnIndex)
        ? body.turnIndex
        : null;
    const cacheable = sessionId !== null && turnIndex !== null;

    if (!question || !answer) {
      return badRequest("Missing required fields: question, answer.");
    }

    // Nothing about a completed turn changes, so a second look at the same
    // report should not be a second bill. RLS scopes the lookup to sessions
    // this user owns.
    if (cacheable) {
      const cached = await getCoachAnswer(supabase, sessionId, turnIndex);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return handleRouteError(
        "POST /api/coach/model-answer",
        new Error("OPENAI_API_KEY is not configured."),
      );
    }

    const systemPrompt = [
      "You are an expert interview coach. Given an interview question and the candidate's actual answer, produce concrete, instructive feedback.",
      rubricGuidance(roundType),
      "Return ONLY a JSON object with this exact shape:",
      '{"modelAnswer": string, "rewrite": string, "tips": string[]}',
      "- modelAnswer: an exemplary answer to the question (concise, realistic, first-person, 4-8 sentences). Invent plausible specifics where needed.",
      "- rewrite: the candidate's OWN answer improved — keep their facts and example, but tighten structure, add specificity, and fix weak spots. Do not fabricate major new achievements.",
      "- tips: 2-4 short, specific, actionable improvements (max ~12 words each).",
      "No markdown, no commentary outside the JSON.",
    ].join("\n");

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: COACH_MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `QUESTION:\n${question}\n\nCANDIDATE ANSWER:\n${answer}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "[POST /api/coach/model-answer] OpenAI rejected the request:",
        response.status,
        detail.slice(0, 500),
      );
      return NextResponse.json(
        { error: "Failed to generate coaching answer." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: OpenAIUsage;
    };

    // Say what actually happened rather than letting it fail as bad JSON.
    if (data.choices?.[0]?.finish_reason === "length") {
      console.error(
        `[POST /api/coach/model-answer] truncated at ${COACH_MAX_TOKENS} tokens.`,
      );
      return NextResponse.json(
        { error: "That answer was too long to coach. Try a shorter one." },
        { status: 502 },
      );
    }

    // "coach" has been a declared LlmCallSite since the usage table was added,
    // and nothing ever wrote it — so every model answer was invisible in
    // `llm_usage` and the cost figures under-reported real spend. Coach calls
    // are not tied to a session (the drills page has none), so `sessionId` is
    // deliberately absent.
    const usage = new UsageCollector();
    usage.record("coach", MODEL, data.usage);
    await usage.flush(supabase, { userId: user.id });

    const content = data.choices?.[0]?.message?.content ?? "";

    let parsed: { modelAnswer?: string; rewrite?: string; tips?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = JSON.parse(jsonrepair(content));
    }

    const tips = Array.isArray(parsed.tips)
      ? parsed.tips
          .filter((t): t is string => typeof t === "string")
          .slice(0, 4)
      : [];

    const result: ModelAnswerResult = {
      modelAnswer:
        typeof parsed.modelAnswer === "string" ? parsed.modelAnswer : "",
      rewrite: typeof parsed.rewrite === "string" ? parsed.rewrite : "",
      tips,
    };

    if (cacheable) {
      await saveCoachAnswer(supabase, {
        sessionId,
        turnIndex,
        roundType: roundType ?? null,
        answer: result,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError("POST /api/coach/model-answer", error);
  }
}
