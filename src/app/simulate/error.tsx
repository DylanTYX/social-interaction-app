"use client";

import { reportClientError } from "@/lib/report-client-error";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Route-level boundary for the interview flow.
 *
 * `simulate/` has no layout of its own, so this sits directly under the root
 * layout. The wording matters more here than elsewhere: if this fires mid-
 * interview the user's immediate fear is that they lost the session, and they
 * did not — turns are persisted server-side as they happen, and the session id
 * is in the URL, so reloading resumes.
 */
export default function SimulateError({
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
    reportClientError("simulate", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive-muted text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          Something went wrong here
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your interview is saved. Every answer is written to the server as you
          go, and the session link in your address bar picks up where you left
          off.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/sessions">Go to my sessions</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
