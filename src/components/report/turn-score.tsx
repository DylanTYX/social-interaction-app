"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { sanitizeNotes } from "@/lib/response-analyzer";
import { cn } from "@/lib/utils";

/**
 * The score and verdict for one answer.
 *
 * The data for this was already being collected, already queried by
 * `/api/sessions/[id]/report`, and already sent to the browser — the report
 * page's payload type simply did not declare the field, so per-answer scores,
 * strengths and gaps were fetched and dropped on every report.
 *
 * That left the user with a single aggregate percentage and no way to tell
 * which answer cost them the marks, against a setup wizard that had promised
 * "per-answer scores, strengths and gaps". This is that promise.
 */

export interface TurnFeedback {
  overallScore: number | null;
  strengths: string[];
  gaps: string[];
}

/**
 * Pull the display fields out of the stored analysis blob.
 *
 * The column is `jsonb` and the shape is whatever the analyzer wrote at the
 * time, so every field is treated as absent until proven otherwise — an older
 * session must render, not throw. `sanitizeNotes` is reused rather than
 * re-implemented: it already caps length and count and flattens newlines, which
 * matters as much here as it does on the prompt path.
 */
export function toTurnFeedback(
  analysis: Record<string, unknown> | null | undefined,
  overallScore: number | null,
): TurnFeedback {
  const source = analysis ?? {};
  return {
    overallScore,
    strengths: sanitizeNotes(source.strengths),
    gaps: sanitizeNotes(source.gaps),
  };
}

/** Bands, not a gradient — a 2-point difference should not change the colour. */
function scoreTone(score: number) {
  if (score >= 75) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (score >= 55) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

export function TurnScore({ feedback }: { feedback: TurnFeedback }) {
  const { overallScore, strengths, gaps } = feedback;

  // A turn can legitimately have no analysis — trivial answers are skipped by
  // the scorer on purpose. Showing nothing is right; showing "0%" would be a
  // lie about the answer rather than an absence of one.
  if (overallScore === null && strengths.length === 0 && gaps.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex max-w-2xl flex-col gap-2">
      {overallScore !== null && (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn("font-semibold", scoreTone(overallScore))}
          >
            {Math.round(overallScore)}%
          </Badge>
          <span className="text-xs text-slate-500">this answer</span>
        </div>
      )}

      {(strengths.length > 0 || gaps.length > 0) && (
        <ul className="space-y-1 text-xs leading-relaxed">
          {strengths.map((note) => (
            <li key={note} className="flex gap-1.5 text-emerald-800">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{note}</span>
            </li>
          ))}
          {gaps.map((note) => (
            <li key={note} className="flex gap-1.5 text-amber-800">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
