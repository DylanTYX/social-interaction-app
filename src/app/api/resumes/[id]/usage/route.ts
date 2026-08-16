import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseUuid } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { countSessionsForResume } from "@/lib/db/sessions";
import { unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * What a delete would cost: how many of this user's sessions use this resume.
 *
 * The job description's twin, and it answers the same question — but the
 * consequence for a resume is worse, not better. A deleted JD leaves the report's
 * own label intact because the report reads it from the `launch_meta` snapshot;
 * a deleted resume takes the interviewer's entire knowledge of the candidate's
 * background out of every remaining turn of an unfinished session, and the FK
 * nulls `resume_id` so nothing points back at what was lost.
 *
 * A sibling route rather than a field on `GET /api/resumes/[id]`, because that
 * read runs on paths that do not care and would then pay for two extra count
 * queries every time.
 *
 * No 404 for an unknown id: this answers "what would deleting this cost", and
 * for a row that does not exist the answer is zero — which is what the count
 * returns anyway. RLS already scopes it to the caller's own sessions.
 */
export async function GET(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `resumeDoc:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");

    const [inProgress, completed] = await Promise.all([
      countSessionsForResume(supabase, id, { status: "in_progress" }),
      countSessionsForResume(supabase, id, { status: "completed" }),
    ]);

    return NextResponse.json({ inProgress, completed });
  } catch (error) {
    return handleRouteError("GET /api/resumes/[id]/usage", error);
  }
}
