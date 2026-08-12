import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  deleteSession,
  getSession,
  updateSession,
  type SessionStatus,
} from "@/lib/db/sessions";
import { handleRouteError, notFound, unauthorized } from "@/lib/api/errors";
import { parseBoundedString, parseUuid } from "@/lib/api/query";
import { MAX_SUMMARY_CHARS } from "@/lib/api/input-limits";

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

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "session id");
    const session = await getSession(supabase, id);
    if (!session) {
      return notFound();
    }

    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError("GET /api/sessions/[id]", error);
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

/** A percentage. Anything else is dropped rather than written. */
function parseScore(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Wall-clock minutes. The cap is a sanity bound, not a product rule. */
function parseDurationMinutes(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(24 * 60, Math.round(value)));
}

/** An ISO timestamp Postgres will accept, or nothing. */
function parseTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "session id");
    const body = await readJsonBody<{
      status?: string;
      summary?: unknown;
      metrics?: Record<string, unknown> | null;
      averageScore?: unknown;
      durationMinutes?: unknown;
      endedAt?: unknown;
    }>(request);

    const status: SessionStatus | undefined =
      body.status === "completed" ||
      body.status === "abandoned" ||
      body.status === "in_progress"
        ? body.status
        : undefined;

    const session = await updateSession(supabase, id, {
      status,
      // The server feeds this straight back into the next interviewer prompt,
      // so an unbounded value inflates every remaining turn of the session.
      summary: parseBoundedString(body.summary, {
        field: "summary",
        max: MAX_SUMMARY_CHARS,
      }),
      metrics: stripServerOwnedMetrics(body.metrics),
      // These three used to pass through untouched into Postgres `int` and
      // `timestamptz` columns, so a NaN or an out-of-range number surfaced as
      // an opaque 500 from the database rather than a 400 from us.
      averageScore: parseScore(body.averageScore),
      durationMinutes: parseDurationMinutes(body.durationMinutes),
      endedAt: parseTimestamp(body.endedAt),
    });

    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError("PATCH /api/sessions/[id]", error);
  }
}

/**
 * Delete one session.
 *
 * Until now the only way to remove a single bad session was "Delete all
 * sessions" in Settings — an all-or-nothing wipe for a single mistake.
 *
 * Same shape as the personas, job-description and resume deletes: authenticate,
 * hand the id to the db helper, let RLS decide ownership. No existence check,
 * so a foreign or already-deleted id returns ok — consistent with the other
 * three, and it means a double-click cannot produce a spurious error.
 */
export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "session id");
    await deleteSession(supabase, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("DELETE /api/sessions/[id]", error);
  }
}
