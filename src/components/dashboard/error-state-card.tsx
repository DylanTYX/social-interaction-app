"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A load failure, shown where the data would have been.
 *
 * The dashboard pages used to render their *empty* state when a fetch failed —
 * so a signed-in user with a dead backend was told "No sessions yet" next to a
 * "Start practicing" button. Reporting failure as absence of data is worse than
 * showing nothing: it is confidently wrong.
 *
 * Shaped like `EmptyStateCard` so the two read as siblings, and like it a box
 * rather than a `Card`, so it nests inside a card cleanly. Red because this is
 * an error, which is the one thing red is for. The icon stays, without a tile:
 * here it carries meaning the colour alone should not have to.
 */
export function ErrorStateCard({
  title = "Couldn't load this",
  description,
  onRetry,
  retrying = false,
}: {
  title?: string;
  /** The server's message when there is one; a generic line otherwise. */
  description?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive-border bg-destructive-subtle px-6 py-10 text-center text-destructive-emphasis"
    >
      <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden />
      <h2 className="mt-3 font-display text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-balance text-destructive-emphasis/80">
        {description?.trim() ||
          "Something went wrong fetching your data. Your work is safe — this is a display problem."}
      </p>
      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="border-destructive-border bg-white hover:bg-destructive-muted"
            onClick={onRetry}
            disabled={retrying}
          >
            <RotateCw className={retrying ? "animate-spin" : undefined} />
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      )}
    </div>
  );
}
