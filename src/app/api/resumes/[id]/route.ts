import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { deleteResume, getResume } from "@/lib/db/resumes";
import { notFound, serverError, unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id } = await ctx.params;
    const resume = await getResume(supabase, id);
    if (!resume) {
      return notFound();
    }

    return NextResponse.json({ resume });
  } catch (error) {
    return serverError("GET /api/resumes/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id } = await ctx.params;
    await deleteResume(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("DELETE /api/resumes/[id]", error);
  }
}
