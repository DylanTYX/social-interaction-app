import { ApiError } from "@/lib/user-facing-error";

/**
 * Read a JSON response, surfacing the server's own error message.
 *
 * On a non-2xx it throws an `ApiError` with `error` from the body when there
 * is one — so callers get "Resume must contain at least 80 characters" rather
 * than a status code. The body is read as text first because an error response
 * is not always JSON: a proxy 502 or an auth redirect returns HTML, and the
 * user is told the request failed, not shown a parser's complaint about "<".
 *
 * Existed as three byte-identical copies across the hooks and persona library.
 */
export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw await apiErrorFrom(response);
  return JSON.parse(await response.text()) as T;
}

/**
 * The error for a non-2xx, for callers whose success body is not JSON (a
 * stream, a download) and so cannot go through `readJson`.
 */
export async function apiErrorFrom(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => "");
  let message =
    response.status === 401
      ? "Your session has expired. Sign in again."
      : "Something went wrong. Please try again.";
  let ref: string | undefined;
  try {
    const parsed = JSON.parse(text) as {
      error?: string;
      ref?: string;
      hint?: string;
    };
    if (typeof parsed?.error === "string" && parsed.error) {
      message = parsed.error;
    }
    // `hint` is only ever sent outside production: it is for whoever runs the
    // deployment. `ref` ties what the user reads to one log line.
    if (typeof parsed?.hint === "string") message = `${message} ${parsed.hint}`;
    if (typeof parsed?.ref === "string") {
      ref = parsed.ref;
      message = `${message} (ref ${ref})`;
    }
  } catch {
    // Not JSON (a proxy's HTML 502): keep the generic message.
  }
  return new ApiError(message, response.status, ref);
}
