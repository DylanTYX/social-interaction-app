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

/**
 * Keys the read helpers still fall back to inside `metrics` when a row predates
 * migration 0009. Because that fallback exists, a client PATCH writing these
 * keys would be read back as authoritative — `loopBrief` goes straight into the
 * interviewer's prompt and `interviewLoop` drives which rubric scores the
 * answer — so they stay stripped until the fallback is removed.
 */
const LEGACY_SERVER_OWNED_KEYS = [
  "launch",
  "loop",
  "competencyCoverage",
] as const;

function stripServerOwnedMetrics(
  metrics: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!metrics || typeof metrics !== "object") return metrics;
  const sanitized = { ...metrics };
  for (const key of LEGACY_SERVER_OWNED_KEYS) delete sanitized[key];
  return sanitized;
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
