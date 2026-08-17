import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/supabase/server";
import { UsageCollector } from "@/lib/api/token-usage";
import { getCoachAnswer, saveCoachAnswer } from "@/lib/db/coach-answers";
import {
  COACH_MAX_TOKENS,
  COACH_MODEL,
  CoachRequestError,
  requestCoaching,
} from "@/lib/coach-prompt";
import { isRoundType } from "@/lib/interview-rounds";
import { badRequest, handleRouteError, unauthorized } from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseBoundedString, parseOptionalUuid } from "@/lib/api/query";
import {
  MAX_COACH_ANSWER_CHARS,
  MAX_COACH_QUESTION_CHARS,
} from "@/lib/api/input-limits";

export const runtime = "nodejs";

/**
 * Far past any real interview — the longest configured round is a few dozen
 * turns — while staying well inside int4.
 */
const MAX_TURN_INDEX = 10_000;

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
        ? (parseOptionalUuid(body.sessionId.trim(), "sessionId") ?? null)
        : null;
    /**
     * Bounded, not merely an integer.
     *
     * `turn_index` is a Postgres `int` and this is a cache *key*: an unchecked
     * value could overflow int4 — which `saveCoachAnswer` then swallowed — and
     * an arbitrary index let a client seed its own cache entries at positions
     * no turn occupies, to be served back later as coaching. Self-scoped, but
     * the cache is trusted unconditionally on read.
     */
    const turnIndex =
      typeof body.turnIndex === "number" &&
      Number.isInteger(body.turnIndex) &&
      body.turnIndex >= 0 &&
      body.turnIndex <= MAX_TURN_INDEX
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
        "POST /api/coach/suggested-answer",
        new Error("OPENAI_API_KEY is not configured."),
      );
    }

    // "coach" has been a declared LlmCallSite since the usage table was added,
    // and nothing ever wrote it — so every suggested answer was invisible in
    // `llm_usage` and the cost figures under-reported real spend. Coach calls
    // are not tied to a session (the drills page has none), so `sessionId` is
    // deliberately absent.
    const usage = new UsageCollector();

    let coached;
    try {
      coached = await requestCoaching({
        question,
        answer,
        roundType,
        apiKey,
        usage,
      });
    } catch (error) {
      if (error instanceof CoachRequestError) {
        console.error(
          "[POST /api/coach/suggested-answer] OpenAI rejected the request:",
          error.status,
          error.detail,
        );
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
      throw error;
    }

    // Usage is recorded even on a truncated call — the tokens were spent
    // whether or not the output was usable, and a cost report that only counts
    // successes understates real spend.
    await usage.flush(supabase);

    // Say what actually happened rather than letting it fail as bad JSON.
    if (coached.finishReason === "length") {
      console.error(
        `[POST /api/coach/suggested-answer] truncated at ${COACH_MAX_TOKENS} tokens.`,
      );
      return NextResponse.json(
        { error: "That answer was too long to coach. Try a shorter one." },
        { status: 502 },
      );
    }

    if (coached.omittedFields.length > 0 || coached.repaired) {
      // Diagnostic, mirroring the analyzer's truncation warning. The product
      // renders whatever came back; this is how a schema regression becomes
      // visible in logs instead of only in the eval harness.
      console.warn(
        `[POST /api/coach/suggested-answer] ${COACH_MODEL} omitted [${coached.omittedFields.join(", ")}]` +
          `${coached.repaired ? " (JSON repaired)" : ""}` +
          `${coached.contractWarnings.length ? ` warnings: ${coached.contractWarnings.join("; ")}` : ""}`,
      );
    }

    const result = coached.result;

    // Both prose fields empty means there is nothing to render. This used to
    // return 200 and paint an empty coaching panel, which reads as the feature
    // being broken with no error to report.
    if (!result.suggestedAnswer && !result.rewrite) {
      console.error(
        "[POST /api/coach/suggested-answer] model returned no usable coaching.",
      );
      return NextResponse.json(
        { error: "Could not generate coaching for that answer. Try again." },
        { status: 502 },
      );
    }

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
    return handleRouteError("POST /api/coach/suggested-answer", error);
  }
}
