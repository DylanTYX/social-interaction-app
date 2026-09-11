import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  deleteSession,
  getSession,
  getSessionActiveSeconds,
  updateSession,
  type SessionStatus,
} from "@/lib/db/sessions";
import {
  ClientVisibleError,
  handleRouteError,
  notFound,
  unauthorized,
} from "@/lib/api/errors";
import { parseBoundedString, parseUuid } from "@/lib/api/query";
import {
  MAX_SESSION_NOTES_CHARS,
  MAX_SESSION_TAGS,
  MAX_SESSION_TITLE_CHARS,
  MAX_SUMMARY_CHARS,
} from "@/lib/api/input-limits";
import { normalizeTags } from "@/lib/session-organisation";

export const runtime = "nodejs";
// Calls a model; do not inherit a short platform default. See `api/chat/route.ts`.
export const maxDuration = 60;

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
      `session:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

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

/**
 * The fields a candidate uses to organise a session (migration 0018).
 *
 * Every one is optional, and a missing key means "leave it alone" — so none is
 * parsed unless it was sent. That matters because the parsers turn anything
 * that is not a string into null, and null is a real value that clears the
 * column.
 */
function parseOrganisation(body: {
  title?: unknown;
  tags?: unknown;
  pinned?: unknown;
  notes?: unknown;
  archived?: unknown;
}) {
  // Blank resets the session to its generated title.
  const title =
    body.title === undefined
      ? undefined
      : parseBoundedString(body.title, {
          field: "title",
          max: MAX_SESSION_TITLE_CHARS,
        });
  const notes =
    body.notes === undefined
      ? undefined
      : parseBoundedString(body.notes, {
          field: "notes",
          max: MAX_SESSION_NOTES_CHARS,
        });

  let tags: string[] | undefined;
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      throw new ClientVisibleError("tags must be a list of labels.");
    }
    tags = normalizeTags(body.tags);
    if (tags.length > MAX_SESSION_TAGS) {
      throw new ClientVisibleError(
        `A session can have up to ${MAX_SESSION_TAGS} tags.`,
      );
    }
  }

  const pinned = typeof body.pinned === "boolean" ? body.pinned : undefined;
  // The server stamps the time; the client only says archived or not.
  const archivedAt =
    typeof body.archived === "boolean"
      ? body.archived
        ? new Date().toISOString()
        : null
      : undefined;

  return { title, notes, tags, pinned, archivedAt };
}

/**
 * The duration to store when a session completes.
 *
 * The time the session page was open and on screen, which the page adds up in
 * `active_seconds` as the interview runs (`useActiveSessionTime`). Elapsed time
 * since `started_at` is only the fallback, for a session with nothing recorded:
 * one begun before active time existed, or a database without the column.
 */
async function completedDurationMinutes(
  supabase: SupabaseClient,
  id: string,
): Promise<number | null | undefined> {
  const activeSeconds = await getSessionActiveSeconds(supabase, id);
  if (activeSeconds !== null && activeSeconds > 0) {
    // A session that really did take under a minute still reads as one.
    return parseDurationMinutes(Math.max(1, Math.round(activeSeconds / 60)));
  }

  const existing = await getSession(supabase, id);
  const startedAtMs = existing ? Date.parse(existing.startedAt) : Number.NaN;
  if (!Number.isFinite(startedAtMs)) return undefined;
  /**
   * Clamped through the same helper as the client path.
   *
   * This derived value had no upper bound while `parseDurationMinutes` capped
   * the client's at 24h — and `interview_sessions_duration_range` checks
   * `duration_minutes <= 1440`. So a session left open overnight violated the
   * constraint and the completion write failed outright, leaving the interview
   * permanently unfinishable.
   */
  return parseDurationMinutes(
    Math.max(1, Math.round((Date.now() - startedAtMs) / 60000)),
  );
}

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `session:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "session id");
    const body = await readJsonBody<{
      status?: string;
      summary?: unknown;
      metrics?: Record<string, unknown> | null;
      averageScore?: unknown;
      durationMinutes?: unknown;
      endedAt?: unknown;
      title?: unknown;
      tags?: unknown;
      pinned?: unknown;
      notes?: unknown;
      archived?: unknown;
    }>(request);

    const organisation = parseOrganisation(body);

    const status: SessionStatus | undefined =
      body.status === "completed" ||
      body.status === "abandoned" ||
      body.status === "in_progress"
        ? body.status
        : undefined;

    /**
     * Duration is derived here, not taken from the client.
     *
     * The client's figure started when its hook mounted, so a resumed session
     * under-counted. Elapsed time since `started_at` replaced it and
     * over-counted instead: leave a session for an hour and come back, and the
     * hour was practice time on the report, the dashboard and the loop total.
     * It is now the time the page was actually on screen.
     */
    let durationMinutes = parseDurationMinutes(body.durationMinutes);
    if (status === "completed") {
      durationMinutes =
        (await completedDurationMinutes(supabase, id)) ?? durationMinutes;
    }

    const session = await updateSession(supabase, id, {
      status,
      // The server feeds this straight back into the next interviewer prompt,
      // so an unbounded value inflates every remaining turn of the session.
      //
      // Parsed only when sent. `parseBoundedString` returns null for a missing
      // value, and null clears the column — so every PATCH that did not mention
      // the summary used to wipe it, which a rename or a tag edit would now do
      // on every call.
      summary:
        body.summary === undefined
          ? undefined
          : parseBoundedString(body.summary, {
              field: "summary",
              max: MAX_SUMMARY_CHARS,
            }),
      metrics: stripServerOwnedMetrics(body.metrics),
      // These three used to pass through untouched into Postgres `int` and
      // `timestamptz` columns, so a NaN or an out-of-range number surfaced as
      // an opaque 500 from the database rather than a 400 from us.
      averageScore: parseScore(body.averageScore),
      durationMinutes,
      endedAt: parseTimestamp(body.endedAt),
      ...organisation,
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

    const limited = enforceRateLimit(
      `session:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "session id");
    await deleteSession(supabase, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("DELETE /api/sessions/[id]", error);
  }
}
