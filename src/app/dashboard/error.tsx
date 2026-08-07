"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Route-level boundary for everything under /dashboard.
 *
 * Rendered *inside* `dashboard/layout.tsx`, so the sidebar and nav survive —
 * a failure in one page does not strand the user with no way out. A throw in
 * the layout itself falls through to `app/global-error.tsx`.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side logging already covers API failures; this catches the render
    // path, which previously produced a blank screen and no record at all.
    console.error("[dashboard] render failed:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">
          This page hit an error
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Nothing was lost — your sessions and settings are stored server-side.
          Try again, or head back to the dashboard.
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
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
