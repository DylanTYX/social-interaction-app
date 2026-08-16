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
  // Capped after all. An offset past the end does return no rows, but Postgres
  // still walks and discards every skipped one — so an unbounded value is a
  // free full scan on a route with no rate limit.
  return Math.min(Math.floor(raw), MAX_OFFSET);
}

/** Far past any real library; a user is paging, not scraping. */
export const MAX_OFFSET = 10_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate an id before it reaches a `uuid` column.
 *
 * Nothing did this, and Postgres is unforgiving about it: `.eq("id", "abc")`
 * raises `22P02`, which surfaced as a **500 with a full stack in the logs**
 * where the honest answer is 404. That made real 500s hard to find, and it was
 * reachable by anyone typing a wrong URL.
 *
 * It also closes a smaller hole. Foreign-key validation triggers run with the
 * referenced table's privileges and **bypass RLS**, so posting another user's
 * job-description id returned 201 while a random uuid returned 500 — an
 * existence oracle across the tenant boundary. Rejecting malformed input does
 * not close that on its own, but it removes the signal that made it legible.
 */
export function parseUuid(value: unknown, field = "id"): string {
  if (typeof value === "string" && UUID_PATTERN.test(value)) return value;
  throw new ClientVisibleError(`Invalid ${field}.`, 404);
}

/** Optional variant: absent stays absent, present must be well-formed. */
export function parseOptionalUuid(
  value: unknown,
  field = "id",
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return parseUuid(value, field);
}

/**
 * Parse a client-supplied string, rejecting anything over `max` characters.
 *
 * Document uploads were capped (30k for a JD, `MAX_RESUME_CHARS` for a resume) but
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

/**
 * One field of a PATCH body, keeping "absent" and "cleared" distinct.
 *
 * `undefined` means the key was not sent and the column must be left alone;
 * `null` means the user cleared it. Collapsing the two is how a dialog that
 * edits only the title comes to blank every other field, so the distinction is
 * carried all the way down to the update payload rather than normalised away
 * here.
 *
 * Throws rather than ignoring a wrong type: a no-op that answers 200 is the
 * worst of the available answers, because the client believes the edit landed.
 */
export function readOptionalString(
  body: Record<string, unknown>,
  key: string,
  maxChars: number,
): string | null | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ClientVisibleError(`${key} must be a string.`, 400);
  }
  if (value.length > maxChars) {
    throw new ClientVisibleError(
      `${key} must be ${maxChars} characters or fewer.`,
      400,
    );
  }
  return value;
}
