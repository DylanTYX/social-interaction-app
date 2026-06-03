import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { resetPersonaPresets } from "@/lib/db/personas";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const personas = await resetPersonaPresets(supabase, user.id);
    return NextResponse.json({ personas });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset presets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
