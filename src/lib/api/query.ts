/**
 * Request-input helpers for route handlers.
 *
 * Both helpers here exist for the same reason: a bound the client cannot talk
 * its way past. `parseLimit` bounds how many rows it can ask for;
 * `parseBoundedString` bounds how much text it can push into a prompt.
 */

import { ClientVisibleError } from "@/lib/api/errors";

/**
 * Parse a `limit` query parameter.
 *
 * The three list endpoints each hand-rolled this with drifting bounds (max 50
 * vs 100, default 20 vs 25). The cap matters: it is the only thing stopping a
 * client from asking for the entire table.
 */
export function parseLimit(
  searchParams: URLSearchParams,
  options: { fallback: number; max: number },
): number {
  const raw = Number(searchParams.get("limit"));
  if (!Number.isFinite(raw) || raw <= 0) return options.fallback;
  return Math.min(Math.floor(raw), options.max);
}

/**
 * Parse an `offset` query parameter.
 *
 * The companion `parseLimit` has always existed; this did not, which is why
 * every list endpoint returned page one and nothing else. Unlike `limit` there
 * is no cap to apply — an offset past the end simply returns no rows — but it
 * must still refuse negatives, which Postgres rejects outright.
 */
export function parseOffset(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("offset"));
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.floor(raw);
}

/**
 * Parse a client-supplied string, rejecting anything over `max` characters.
 *
 * Document uploads were capped (30k for a JD, `MAX_RESUME_CHARS` for a CV) but
 * the per-turn fields that reach a model were not: `userMessage` went to the
 * interviewer, the analyzer *and* an embedding call with no bound at all, and
 * the coach route interpolated an unbounded question and answer straight into
 * its prompt. One request could cost real money.
 *
 * Deliberately **rejects rather than truncates**. Silently cutting an answer in
 * half would score the candidate on something they did not say — the failure
 * mode is worse than the error message. The caps are set far above any genuine
 * answer (10k characters is roughly a twelve-minute monologue), so a rejection
 * means a bug or an abuse attempt, not a talkative user.
 *
 * Throws `ClientVisibleError`, so it composes inside helpers and is surfaced by
 * `handleRouteError`.
 */
export function parseBoundedString(
  value: unknown,
  options: { field: string; max: number; required?: boolean },
): string | null {
  if (typeof value !== "string") {
    if (options.required) {
      throw new ClientVisibleError(`Missing required field: ${options.field}.`);
    }
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    if (options.required) {
      throw new ClientVisibleError(`Missing required field: ${options.field}.`);
    }
    return null;
  }

  if (trimmed.length > options.max) {
    throw new ClientVisibleError(
      `${options.field} is too long (${trimmed.length.toLocaleString()} characters). ` +
        `Keep it under ${options.max.toLocaleString()}.`,
    );
  }

  return trimmed;
}
