import { NextResponse } from "next/server";

import { ACTIVITY_CHUNK_SECONDS } from "@/lib/active-time";
import {
  ClientVisibleError,
  handleRouteError,
  unauthorized,
} from "@/lib/api/errors";
import { parseUuid } from "@/lib/api/query";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import { recordSessionActivity } from "@/lib/db/sessions";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Seconds a session page was open and on screen, added to the session.
 *
 * Sent by `useActiveSessionTime` every half minute and when the page is hidden
 * or closed. The total becomes the session's duration when it completes (see
 * PATCH `/api/sessions/[id]`), so leaving an interview and coming back later
 * adds nothing.
 *
 * `record_session_activity` re-checks ownership, adds at most two minutes a
 * call and ignores a session no longer in progress, so this route only has to
 * turn a malformed body into a 400 rather than a database error.
 */
export async function POST(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    // Its own bucket: an open session sends two of these a minute, and they
    // must not use up the budget its real writes draw on.
    const limited = enforceRateLimit(
      `session-activity:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "session id");
    const body = await readJsonBody<{ seconds?: unknown }>(request);
    const seconds = body.seconds;
    if (
      typeof seconds !== "number" ||
      !Number.isInteger(seconds) ||
      seconds < 1 ||
      seconds > ACTIVITY_CHUNK_SECONDS
    ) {
      throw new ClientVisibleError(
        `seconds must be a whole number from 1 to ${ACTIVITY_CHUNK_SECONDS}.`,
      );
    }

    const activeSeconds = await recordSessionActivity(supabase, id, seconds);
    return NextResponse.json({ activeSeconds });
  } catch (error) {
    return handleRouteError("POST /api/sessions/[id]/activity", error);
  }
}
