"use client";

import { reportClientError } from "@/lib/report-client-error";
import { useEffect } from "react";

// `global-error` replaces the root layout entirely when it renders, so it gets
// none of that file's work: no <html>/<body>, no font variables, and no
// stylesheet unless it imports one itself.
import "./globals.css";

/**
 * Last-resort boundary. Only reached when the root layout itself throws — the
 * per-segment `error.tsx` files handle everything below them.
 *
 * Deliberately minimal and dependency-free: shared components could be part of
 * what is broken, and this is the screen that has to render no matter what.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Transmitted, not just logged locally: this used to `console.error` in the
    // user's own browser, so a render crash left no record anywhere and the
    // "Reference" shown below matched nothing on the server.
    reportClientError("global", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
            background: "#f9fafb",
          }}
        >
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              ConvoTrainer couldn&apos;t start
            </h1>
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.875rem",
                color: "#4b5563",
              }}
            >
              An unexpected error stopped the app from loading. Your account and
              interview history are unaffected.
            </p>
            {error.digest && (
              <p
                style={{
                  marginTop: "0.75rem",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                }}
              >
                Reference: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "1.5rem",
                borderRadius: "0.5rem",
                background: "#111827",
                color: "#fff",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                border: "none",
              }}
            >
              Reload the app
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
