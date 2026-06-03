import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  getSession,
  updateSession,
  type SessionStatus,
} from "@/lib/db/sessions";

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
    const session = await getSession(supabase, id);
    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      metrics: body.metrics,
      averageScore: body.averageScore,
      durationMinutes: body.durationMinutes,
      endedAt: body.endedAt,
    });

    return NextResponse.json({ session });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
