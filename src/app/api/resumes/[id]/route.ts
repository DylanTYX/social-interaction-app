import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseUuid } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { deleteResume, getResume } from "@/lib/db/resumes";
import { notFound, unauthorized, handleRouteError } from "@/lib/api/errors";

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

    const limited = enforceRateLimit(
      `resumeDoc:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    const resume = await getResume(supabase, id);
    if (!resume) {
      return notFound();
    }

    return NextResponse.json({ resume });
  } catch (error) {
    return handleRouteError("GET /api/resumes/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
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
    await deleteResume(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("DELETE /api/resumes/[id]", error);
  }
}
