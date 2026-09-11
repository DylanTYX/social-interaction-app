import { NextResponse } from "next/server";

import { handleRouteError, unauthorized } from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { listSessionTags } from "@/lib/db/sessions";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Every tag the user has put on a session, most used first. */
export async function GET() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `sessions:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    return NextResponse.json({ tags: await listSessionTags(supabase) });
  } catch (error) {
    return handleRouteError("GET /api/sessions/tags", error);
  }
}
