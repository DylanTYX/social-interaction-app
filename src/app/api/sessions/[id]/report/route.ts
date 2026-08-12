import { parseUuid } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { getSession, listMessages, listTurnAnalyses } from "@/lib/db/sessions";
import { getJobDescription } from "@/lib/db/job-descriptions";
import { notFound, unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

/** Transcript rows rendered in a report. Well past any real session length. */
const MAX_REPORT_MESSAGES = 400;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Aggregates everything the report page needs for a past session in one
 * round trip: the session row, its full message transcript, the per-turn
 * analyses, and (if linked) a lightweight summary of the attached job
 * description.
 */
export async function GET(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `report:${user.id}`,
      RATE_LIMITS.heavyRead,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "session id");
    const session = await getSession(supabase, id);
    if (!session) {
      return notFound();
    }

    const [messages, turnAnalyses] = await Promise.all([
      // The resume endpoint has always capped this at 200; the report did not,
      // so the longest sessions read the most rows on the least urgent path.
      listMessages(supabase, id, { limit: MAX_REPORT_MESSAGES }),
      listTurnAnalyses(supabase, id),
    ]);

    let jobDescription: {
      id: string;
      title: string;
      roleTitle: string | null;
    } | null = null;
    if (session.jobDescriptionId) {
      const record = await getJobDescription(
        supabase,
        session.jobDescriptionId,
      );
      if (record) {
        jobDescription = {
          id: record.id,
          title: record.title,
          roleTitle: record.roleTitle,
        };
      }
    }

    // `turnAnalyses` is empty for sessions recorded before migration 0006 —
    // consumers must treat it as optional rather than assuming one per turn.
    return NextResponse.json({
      session,
      messages,
      turnAnalyses,
      jobDescription,
    });
  } catch (error) {
    return handleRouteError("GET /api/sessions/[id]/report", error);
  }
}
