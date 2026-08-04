import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSession, listMessages } from "@/lib/db/sessions";
import { parseSessionMetrics } from "@/lib/session-launch-meta";
import { getJobDescription } from "@/lib/db/job-descriptions";
import { serverError, unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

/**
 * Rehydrates an in-progress session for `/simulate/chat?session=` or
 * `/simulate/voice?session=`.
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

    const { id } = await context.params;
    const session = await getSession(supabase, id);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const messages = await listMessages(supabase, id, { limit: 200 });
    const metrics = parseSessionMetrics(session.metrics);

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
      launch: metrics.launch ?? null,
      jobDescription,
    });
  } catch (error) {
    return serverError("GET /api/sessions/[id]/resume", error);
  }
}
