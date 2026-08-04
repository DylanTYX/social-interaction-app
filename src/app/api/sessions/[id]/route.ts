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

/**
 * Keys inside `metrics` that only server code may write. `launch` is the
 * session's setup snapshot and `loop` is multi-round progress; both are
 * written at launch / round handoff and read back by `/api/chat`,
 * `next-round`, and the resume endpoint. Clients PATCH this column with score
 * metrics on every scored turn, so whatever they send for these keys is
 * dropped rather than trusted — `updateSession` then merges the rest over the
 * stored value, leaving the server-owned keys intact.
 */
const SERVER_OWNED_METRIC_KEYS = ["launch", "loop"] as const;

function stripServerOwnedMetrics(
  metrics: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!metrics || typeof metrics !== "object") return metrics;
  const sanitized = { ...metrics };
  for (const key of SERVER_OWNED_METRIC_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
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
      metrics: stripServerOwnedMetrics(body.metrics),
      averageScore: body.averageScore,
      durationMinutes: body.durationMinutes,
      endedAt: body.endedAt,
    });

    return NextResponse.json({ session });
  } catch (error) {
    return serverError("PATCH /api/sessions/[id]", error);
  }
}
