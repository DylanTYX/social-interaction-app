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
 * Postgres and PostgREST codes that mean the database schema is older than
 * the code — a column or table the app reads does not exist yet.
 *
 * A database missing one migration took down every interview turn with
 * nothing to say why. The fix is always the same, so the log line says it, and
 * so does the response outside production.
 */
const SCHEMA_BEHIND_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const SCHEMA_BEHIND =
  "The database is behind this version of the app. Apply the newest migrations in supabase/migrations, in order.";

/**
 * Whether a response may carry detail meant for whoever runs the deployment.
 *
 * A variable name, a folder path or a database error class tells a visitor
 * what the system is built from. In production that detail goes to the log,
 * under the `ref` the visitor is shown; everywhere else it also rides along.
 */
function showsOperatorDetail(): boolean {
  return process.env.NODE_ENV !== "production";
}

function newRef(): string {
  return (
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10)
  );
}

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
  const ref = newRef();
  const code = safeErrorCode(error);
  const hint = code && SCHEMA_BEHIND_CODES.has(code) ? SCHEMA_BEHIND : null;
  console.error(
    `[${scope}] ref=${ref}${code ? ` code=${code}` : ""}${hint ? ` hint="${hint}"` : ""}`,
    error,
  );
  // `error` is always the generic message and `ref` ties it to one log line.
  // The error class and the hint name what the system is built from, so they
  // are left out in production.
  return NextResponse.json(
    {
      error: GENERIC_500,
      ref,
      ...(showsOperatorDetail() && code ? { code } : {}),
      ...(showsOperatorDetail() && hint ? { hint } : {}),
    },
    { status: 500 },
  );
}

/**
 * A database error class, if the error carries one — and only that.
 *
 * "Something went wrong" on every failure meant a report from a deployed
 * session could not be told apart from any other: a missing grant, a missing
 * function and an OpenAI outage all read the same, and the only way to learn
 * which was to find the right line in a log the reporter cannot see. A
 * Postgres SQLSTATE (`42501`) or PostgREST code (`PGRST202`) names the class of
 * failure without naming anything inside it.
 */
function safeErrorCode(error: unknown): string | null {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  return typeof code === "string" && /^([0-9A-Z]{5}|PGRST\d{3})$/.test(code)
    ? code
    : null;
}

/** 400 with a message written by us — safe to show the user verbatim. */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** 401 for a missing or expired session. */
export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Your session has expired. Sign in again." },
    { status: 401 },
  );
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
  /**
   * What whoever runs the deployment should fix. Always logged; sent to the
   * client only outside production.
   */
  readonly operatorHint?: string;

  constructor(message: string, status = 400, operatorHint?: string) {
    super(message);
    this.name = "ClientVisibleError";
    this.status = status;
    this.operatorHint = operatorHint;
  }
}

/**
 * Single catch-block helper: re-surface `ClientVisibleError` with its own
 * status and message, and swallow everything else into a logged 500.
 */
export function handleRouteError(scope: string, error: unknown): NextResponse {
  if (error instanceof ClientVisibleError) {
    if (!error.operatorHint) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const ref = newRef();
    console.error(`[${scope}] ref=${ref} hint="${error.operatorHint}"`);
    return NextResponse.json(
      {
        error: error.message,
        ref,
        ...(showsOperatorDetail() ? { hint: error.operatorHint } : {}),
      },
      { status: error.status },
    );
  }
  return serverError(scope, error);
}
