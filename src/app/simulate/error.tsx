"use client";

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
    console.error("[simulate] render failed:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">
          Something went wrong here
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Your interview is saved. Every answer is written to the server as you
          go, and the session link in your address bar picks up where you left
          off.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-gray-400">
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
