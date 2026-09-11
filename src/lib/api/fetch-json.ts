/**
 * Read a JSON response, surfacing the server's own error message.
 *
 * On a non-2xx it throws with `error` from the body when there is one, falling
 * back to the status — so callers get "Resume must contain at least 80
 * characters" rather than "HTTP 400". The body is read as text first because
 * an error response is not always JSON: a proxy 502 or an auth redirect
 * returns HTML, and parsing that would mask the real status.
 *
 * Existed as three byte-identical copies across the hooks and persona library.
 */
export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status}).`;
    try {
      const parsed = JSON.parse(text) as {
        error?: string;
        ref?: string;
        code?: string;
      };
      if (parsed?.error) message = parsed.error;
      // A generic server error carries a reference into the log. Show it, so a
      // report of "something went wrong" can be matched to the failure.
      const detail = [parsed?.ref && `ref ${parsed.ref}`, parsed?.code]
        .filter(Boolean)
        .join(" · ");
      if (detail) message = `${message} (${detail})`;
    } catch {
      // Non-JSON error body; the status message is the best we have.
    }
    throw new Error(message);
  }

  return JSON.parse(text) as T;
}
