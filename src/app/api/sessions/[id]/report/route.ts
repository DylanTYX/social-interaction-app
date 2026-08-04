import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSession, listMessages } from "@/lib/db/sessions";
import { getJobDescription } from "@/lib/db/job-descriptions";
import { notFound, serverError, unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Aggregates everything the report page needs for a past session in one
 * round trip: the session row, its full message transcript, and (if linked)
 * a lightweight summary of the attached job description.
 */
export async function GET(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id } = await ctx.params;
    const session = await getSession(supabase, id);
    if (!session) {
      return notFound();
    }

    const messages = await listMessages(supabase, id);

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

    return NextResponse.json({ session, messages, jobDescription });
  } catch (error) {
    return serverError("GET /api/sessions/[id]/report", error);
  }
}
