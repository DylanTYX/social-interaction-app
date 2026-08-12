import { NextResponse } from "next/server";

/**
 * Fixed-window per-user rate limiter for the routes that spend money
 * (OpenAI chat/analysis/coaching, Azure token minting).
 *
 * IMPORTANT — this counter lives in the process heap. It is correct for a
 * single instance and is *not* shared across regions, serverless instances, or
 * a restart. That is deliberate for the current scale: it caps the blast
 * radius of a runaway client without adding infrastructure. Before scaling to
 * more than one instance, swap `buckets` for Redis/Upstash — the call sites do
 * not need to change, only this module.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Drop expired buckets so the Map cannot grow without bound on a long-lived
 * instance. Cheap because it only runs when the Map is already large.
 */
const SWEEP_THRESHOLD = 10_000;

function sweep(now: number): void {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets. Only meaningful when `ok` is false. */
  retryAfter: number;
  /** Requests still available in the current window. */
  remaining: number;
}

function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.count += 1;
  return { ok: true, retryAfter: 0, remaining: limit - bucket.count };
}

/**
 * Budgets per user per minute. Interview turns are the hot path; coaching and
 * speech tokens are bursty but far less frequent. All are well above what the
 * UI can generate through normal use, so a user only ever sees a 429 when
 * something is looping.
 */
export const RATE_LIMITS = {
  /** One interview turn ≈ 1 request. 60/min tolerates retries and streaming fallbacks. */
  chat: { limit: 60, windowMs: 60_000 },
  /** Explicit user action on the report/drills pages. */
  coach: { limit: 20, windowMs: 60_000 },
  /** Tokens last ~10 minutes; the client refreshes far less often than this. */
  speechToken: { limit: 20, windowMs: 60_000 },
  /** Uploading + embedding a document is the most expensive single action. */
  documentUpload: { limit: 15, windowMs: 60_000 },
  /**
   * Reads that fan out across a user's whole history: the full-account export,
   * the loop report (one analyses query per round) and the single-session
   * report. Cheap per row, but unbounded in row count, so they are the easiest
   * way to make the database do a lot of work from one click.
   */
  heavyRead: { limit: 30, windowMs: 60_000 },
  /** Creates a session row per call, so it needs a ceiling like any write. */
  nextRound: { limit: 20, windowMs: 60_000 },
  /**
   * The general bucket for everything else: session and library CRUD, and the
   * ordinary list reads.
   *
   * Nine routes had no limit at all — including `POST /api/sessions` (a row per
   * call, with unbounded JSONB on it), `GET /api/sessions/[id]/resume` (200
   * messages plus every turn analysis, the same cost profile as `/report`,
   * which *was* limited), and `POST /api/personas/reset` (thirteen statements
   * per call). Generous enough that the UI cannot reach it.
   */
  standard: { limit: 60, windowMs: 60_000 },
} as const;

/**
 * Apply a limit and return a ready-to-send 429, or `null` when the request may
 * proceed.
 *
 *   const limited = enforceRateLimit(`chat:${user.id}`, RATE_LIMITS.chat);
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  key: string,
  config: { limit: number; windowMs: number },
): NextResponse | null {
  const result = checkRateLimit(key, config.limit, config.windowMs);
  if (result.ok) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "Cache-Control": "no-store",
      },
    },
  );
}
