import { NextResponse } from "next/server";

/**
 * Route-handler error helpers.
 *
 * Why: handlers used to return `error.message` straight to the client. That
 * message is frequently a Postgres error (table names, constraint names, RLS
 * policy names) or a stringified OpenAI error body — free reconnaissance for
 * an attacker and noise for everyone else. Internal detail now goes to the
 * server log only; the client gets a stable, generic message.
 *
 * Validation failures the app authors itself are a different thing: those are
 * safe, actionable, and should reach the user. Use `badRequest` for them.
 */

const GENERIC_500 = "Something went wrong. Please try again.";

/**
 * Log the real error server-side and return an opaque 500.
 *
 * `scope` is a short tag identifying the handler (e.g. "POST /api/chat") so
 * the log line is greppable.
 */
/**
 * Deliberately not exported.
 *
 * Every route reaches this through `handleRouteError`. Calling it directly is
 * the mistake that flattened fourteen routes' `ClientVisibleError`s into 500s —
 * a `parseUuid` rejection surfaced as "something went wrong" instead of a 404
 * — so the only way to log-and-500 is now the one that checks first.
 */
function serverError(scope: string, error: unknown): NextResponse {
  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: GENERIC_500 }, { status: 500 });
}

/** 400 with a message written by us — safe to show the user verbatim. */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** 401 for a missing or expired session. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** 404 for a row that does not exist, or that RLS hides from this user. */
export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * A validation error raised deep in a helper (rather than in the handler) so
 * the handler can distinguish "the user sent something bad" from "we broke".
 * `parsePdfUpload` and friends throw this.
 */
export class ClientVisibleError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ClientVisibleError";
    this.status = status;
  }
}

/**
 * Single catch-block helper: re-surface `ClientVisibleError` with its own
 * status and message, and swallow everything else into a logged 500.
 */
export function handleRouteError(scope: string, error: unknown): NextResponse {
  if (error instanceof ClientVisibleError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return serverError(scope, error);
}
