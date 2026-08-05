import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  getSession,
  updateSession,
  type SessionStatus,
} from "@/lib/db/sessions";
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
    const session = await getSession(supabase, id);
    if (!session) {
      return notFound();
    }

    return NextResponse.json({ session });
  } catch (error) {
    return serverError("GET /api/sessions/[id]", error);
  }
}

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id } = await ctx.params;
    const body = (await request.json()) as {
      status?: string;
      summary?: string | null;
      metrics?: Record<string, unknown> | null;
      averageScore?: number | null;
      durationMinutes?: number | null;
      endedAt?: string | null;
    };

    const status: SessionStatus | undefined =
      body.status === "completed" ||
      body.status === "abandoned" ||
      body.status === "in_progress"
        ? body.status
        : undefined;

    const session = await updateSession(supabase, id, {
      status,
      summary: body.summary,
      // No denylist needed: launch, loop and coverage are their own
      // columns now, and this endpoint cannot write them.
      metrics: body.metrics,
      averageScore: body.averageScore,
      durationMinutes: body.durationMinutes,
      endedAt: body.endedAt,
    });

    return NextResponse.json({ session });
  } catch (error) {
    return serverError("PATCH /api/sessions/[id]", error);
  }
}
