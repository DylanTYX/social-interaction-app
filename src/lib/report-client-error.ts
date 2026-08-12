"use client";

/**
 * Send a render crash somewhere a human can find it.
 *
 * The `error.tsx` boundaries used to `console.error` and stop, which put the
 * only record of a crash in the browser of the person who hit it. `error.digest`
 * was then shown to them as a "Reference" that matched nothing on the server.
 *
 * Best-effort by construction: a boundary is already the failure path, and a
 * failure to report a failure must not throw out of one. `keepalive` so the
 * request survives the navigation a user usually makes straight afterwards.
 */
export function reportClientError(
  scope: string,
  error: Error & { digest?: string },
): void {
  try {
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        scope,
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        pathname:
          typeof window === "undefined" ? null : window.location.pathname,
      }),
    }).catch(() => {
      // Offline, blocked, or signed out. The console line below still stands.
    });
  } catch {
    // `fetch` itself unavailable. Nothing further to try.
  }

  // Kept as well as, not instead of: it is what makes the failure visible while
  // developing, where there is no server log being watched.
  console.error(`[${scope}] render failed:`, error);
}
