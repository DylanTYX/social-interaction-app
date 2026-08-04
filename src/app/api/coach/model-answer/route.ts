import { NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

import { getCurrentUser } from "@/lib/supabase/server";
import {
  ROUND_RUBRIC_LABELS,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
import { badRequest, serverError, unauthorized } from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

const MODEL = process.env.COACH_MODEL ?? "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface ModelAnswerResult {
  modelAnswer: string;
  rewrite: string;
  tips: string[];
}

function rubricGuidance(roundType: InterviewRoundType | undefined): string {
  switch (roundType) {
    case "technical_swe":
    case "system_design":
    case "case":
      return `This is a ${ROUND_RUBRIC_LABELS[roundType] ?? "technical"} question. A strong answer is structured: clarify the problem, state assumptions, reason through tradeoffs out loud, and land on a concrete approach with complexity/impact.`;
    default:
      return "This is a behavioral question. A strong answer uses the STAR structure (Situation, Task, Action, Result) with a specific, first-person example and a quantified outcome.";
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(`coach:${user.id}`, RATE_LIMITS.coach);
    if (limited) return limited;

    const body = (await request.json()) as Record<string, unknown>;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    const roundType =
      typeof body.roundType === "string"
        ? (body.roundType as InterviewRoundType)
        : undefined;

    if (!question || !answer) {
      return badRequest("Missing required fields: question, answer.");
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return serverError(
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
        max_tokens: 700,
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
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";

    let parsed: { modelAnswer?: string; rewrite?: string; tips?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = JSON.parse(jsonrepair(content));
    }

    const tips = Array.isArray(parsed.tips)
      ? parsed.tips.filter((t): t is string => typeof t === "string").slice(0, 4)
      : [];

    const result: ModelAnswerResult = {
      modelAnswer:
        typeof parsed.modelAnswer === "string" ? parsed.modelAnswer : "",
      rewrite: typeof parsed.rewrite === "string" ? parsed.rewrite : "",
      tips,
    };
    return NextResponse.json(result);
  } catch (error) {
    return serverError("POST /api/coach/model-answer", error);
  }
}
