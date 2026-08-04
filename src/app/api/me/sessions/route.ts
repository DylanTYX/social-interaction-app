import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { serverError, unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

/**
 * Wipes every interview session (and, via cascade, every message) for the
 * current user. Personas and job descriptions are kept.
 */
export async function DELETE() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
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
    return serverError("DELETE /api/me/sessions", error);
  }
}
