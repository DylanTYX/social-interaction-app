"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * A load failure, shown where the data would have been.
 *
 * The dashboard pages used to render their *empty* state when a fetch failed —
 * so a signed-in user with a dead backend was told "No sessions yet" next to a
 * "Start practicing" button. Reporting failure as absence of data is worse than
 * showing nothing: it is confidently wrong.
 *
 * Shaped like `EmptyStateCard` so the two read as siblings, with one addition
 * that matters: a retry. Every one of these hooks already exposes `refresh`;
 * no page was calling it.
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
    <Card
      role="alert"
      className="border-red-200 bg-red-50/60 text-red-900"
    >
      <CardHeader className="justify-items-center pt-8 pb-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <CardTitle className="pt-3 text-lg">{title}</CardTitle>
        <CardDescription className="mx-auto max-w-md text-balance text-red-800/80">
          {description?.trim() ||
            "Something went wrong fetching your data. Your work is safe — this is a display problem."}
        </CardDescription>
      </CardHeader>
      {onRetry && (
        <CardContent className="flex justify-center pb-8">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 border-red-300 bg-white hover:bg-red-50"
            onClick={onRetry}
            disabled={retrying}
          >
            <RotateCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
