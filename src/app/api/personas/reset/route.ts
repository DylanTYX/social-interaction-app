import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { resetPersonaPresets } from "@/lib/db/personas";
import { unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const personas = await resetPersonaPresets(supabase, user.id);
    return NextResponse.json({ personas });
  } catch (error) {
    return handleRouteError("POST /api/personas/reset", error);
  }
}
