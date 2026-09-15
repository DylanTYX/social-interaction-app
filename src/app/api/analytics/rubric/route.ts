import { NextResponse } from "next/server";

import { handleRouteError, unauthorized } from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { listRecentAnswerScores } from "@/lib/db/sessions";
import { summariseAnswers } from "@/lib/progress-insights";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * The user's recent answers, summarised by round type: the average for each
 * rubric criterion and how it has changed, the weakest one where there is
 * enough to say, what answers most often lacked, and the analyzer's latest
 * notes.
 *
 * Read-only. It aggregates rows the interview has already written; it stores
 * nothing and calls no model. Summarised here rather than in the browser so
 * the analysis blobs never leave the server.
 */
export async function GET() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    // A read across the whole history, so it shares the heavy-read budget
    // with the export and the reports.
    const limited = enforceRateLimit(
      `analytics:${user.id}`,
      RATE_LIMITS.heavyRead,
    );
    if (limited) return limited;

    const rows = await listRecentAnswerScores(supabase);
    return NextResponse.json({
      answers: rows.length,
      rounds: summariseAnswers(rows),
    });
  } catch (error) {
    return handleRouteError("GET /api/analytics/rubric", error);
  }
}
