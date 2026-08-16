import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseUuid } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSession, listMessages, listTurnAnalyses } from "@/lib/db/sessions";
import { readLaunchMeta } from "@/lib/session-launch-meta";
import { getJobDescription } from "@/lib/db/job-descriptions";
import { getResume } from "@/lib/db/resumes";
import { notFound, unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

/**
 * Rehydrates an in-progress session for `/simulate/chat?session=` or
 * `/simulate/voice?session=`.
 *
 * `turnAnalyses` matters as much as the messages: without it the client
 * restarts its scoring history empty, so the running average regresses to
 * whatever was scored after the resume, and the first post-resume turn
 * overwrites the stored `dimensionSnapshots` array with a single element
 * (`updateSession` merges metrics shallowly).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `resume:${user.id}`,
      RATE_LIMITS.heavyRead,
    );
    if (limited) return limited;

    const { id: rawId } = await context.params;
    const id = parseUuid(rawId, "session id");
    const session = await getSession(supabase, id);
    if (!session) {
      return notFound("Session not found.");
    }

    const [messages, turnAnalyses] = await Promise.all([
      listMessages(supabase, id, { limit: 200 }),
      listTurnAnalyses(supabase, id),
    ]);

    /**
     * The live resume, alongside the live job description.
     *
     * Neither this lookup nor a `resume` key existed, so the client had nothing
     * to reconcile its snapshot against — and `sessionRowToLaunch` responded by
     * dropping the resume config entirely, showing the toggle off while the server
     * went on feeding `session.resumeId` into every turn.
     */
    let resume: { id: string; title: string } | null = null;
    if (session.resumeId) {
      const record = await getResume(supabase, session.resumeId);
      if (record) resume = { id: record.id, title: record.title };
    }

    let jobDescription: {
      id: string;
      title: string;
      roleTitle: string | null;
    } | null = null;

    if (session.jobDescriptionId) {
      const jd = await getJobDescription(supabase, session.jobDescriptionId);
      if (jd) {
        jobDescription = {
          id: jd.id,
          title: jd.title,
          roleTitle: jd.roleTitle,
        };
      }
    }

    return NextResponse.json({
      session,
      messages,
      turnAnalyses,
      launch: readLaunchMeta(session) ?? null,
      jobDescription,
      resume,
    });
  } catch (error) {
    return handleRouteError("GET /api/sessions/[id]/resume", error);
  }
}
