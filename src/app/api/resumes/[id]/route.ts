import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { deleteResume, getResume } from "@/lib/db/resumes";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const resume = await getResume(supabase, id);
    if (!resume) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ resume });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load resume.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    await deleteResume(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete resume.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
