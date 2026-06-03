import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Wipes every interview session (and, via cascade, every message) for the
 * current user. Personas and job descriptions are kept.
 */
export async function DELETE() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("interview_sessions")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete sessions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
