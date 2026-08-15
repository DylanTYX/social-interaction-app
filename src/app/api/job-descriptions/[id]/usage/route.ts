import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseUuid } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { countSessionsForJobDescription } from "@/lib/db/sessions";
import { unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * What a delete would cost: how many of this user's sessions use this JD.
 *
 * A sibling route rather than a field on `GET /api/job-descriptions/[id]`,
 * because that read runs on paths that do not care and would then pay for two
 * extra count queries every time.
 *
 * `inProgress` is the number that matters and the reason this exists —
 * deleting nulls `job_description_id` on those sessions and cascades the JD's
 * chunks, so an unfinished interview loses its grounding the moment it resumes.
 * `completed` is returned alongside it for context but is genuinely unharmed:
 * transcripts, scores and the report's own JD label all survive, the last
 * because the report reads it from the `launch_meta` snapshot rather than
 * joining the live table.
 *
 * No 404 for an unknown id. This answers "what would deleting this cost" and
 * the answer for a row that does not exist is zero, which is what the count
 * returns anyway; RLS already scopes it to the caller's own sessions.
 */
export async function GET(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `jobDescription:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");

    const [inProgress, completed] = await Promise.all([
      countSessionsForJobDescription(supabase, id, { status: "in_progress" }),
      countSessionsForJobDescription(supabase, id, { status: "completed" }),
    ]);

    return NextResponse.json({ inProgress, completed });
  } catch (error) {
    return handleRouteError("GET /api/job-descriptions/[id]/usage", error);
  }
}
