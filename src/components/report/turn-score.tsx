"use client";

import { CheckCircle2, CircleAlert, Quote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SIGNAL_READINGS } from "@/lib/report-insights";
import { sanitizeNotes } from "@/lib/response-analyzer";
import type { BehavioralSignalType } from "@/lib/text-metrics";

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
  /**
   * The evidence-gap phrases the interviewer detected in this answer, with a
   * plain-language reading of what each left unestablished. Deterministic
   * (`detectBehavioralSignals`), so every quoted word genuinely appears in the
   * answer above it.
   */
  languageNotes: { marker: string; reading: string }[];
}

/*
 * Three signals max per answer. The full marker list lives in the stored
 * analysis; this is a report footnote, not a second transcript, and ten quoted
 * hedges under one bubble reads as a telling-off rather than feedback. The
 * readings themselves live in `report-insights.ts`, shared with analytics.
 */

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

  // Rows persisted before the signal taxonomy existed carry no
  // `languageSignals`; render nothing rather than guessing.
  const languageNotes = (() => {
    const raw = source.languageSignals as
      { signals?: { type?: string; markers?: unknown[] }[] } | undefined;
    if (!Array.isArray(raw?.signals)) return [];
    const notes: { marker: string; reading: string }[] = [];
    for (const signal of raw.signals) {
      const reading =
        typeof signal?.type === "string" && signal.type in SIGNAL_READINGS
          ? SIGNAL_READINGS[signal.type as BehavioralSignalType]
          : null;
      const marker = Array.isArray(signal?.markers)
        ? signal.markers.find((m): m is string => typeof m === "string")
        : undefined;
      if (reading && marker) notes.push({ marker, reading });
      if (notes.length >= 3) break;
    }
    return notes;
  })();

  return {
    overallScore,
    strengths: sanitizeNotes(source.strengths),
    gaps: sanitizeNotes(source.gaps),
    languageNotes,
  };
}

/**
 * Two bands, not a gradient — a 2-point difference should not change the
 * colour. Green means a strong answer; amber means one that needs attention.
 * There is no red band: red is for errors, and a weak answer is not an error.
 * See docs/DESIGN.md.
 */
function scoreTone(score: number): "success" | "warning" {
  return score >= 75 ? "success" : "warning";
}

export function TurnScore({ feedback }: { feedback: TurnFeedback }) {
  const { overallScore, strengths, gaps, languageNotes } = feedback;

  // A turn can legitimately have no analysis — trivial answers are skipped by
  // the scorer on purpose. Showing nothing is right; showing "0%" would be a
  // lie about the answer rather than an absence of one.
  if (
    overallScore === null &&
    strengths.length === 0 &&
    gaps.length === 0 &&
    languageNotes.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-2 flex max-w-2xl flex-col gap-2">
      {overallScore !== null && (
        <div className="flex items-center gap-2">
          <Badge
            variant={scoreTone(overallScore)}
            className="font-semibold tabular-nums"
          >
            {Math.round(overallScore)}%
          </Badge>
          <span className="text-xs text-muted-foreground">this answer</span>
        </div>
      )}

      {(strengths.length > 0 ||
        gaps.length > 0 ||
        languageNotes.length > 0) && (
        <ul className="space-y-1 text-xs leading-relaxed">
          {strengths.map((note) => (
            <li key={note} className="flex gap-1.5 text-success-emphasis">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{note}</span>
            </li>
          ))}
          {gaps.map((note) => (
            <li key={note} className="flex gap-1.5 text-warning-emphasis">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{note}</span>
            </li>
          ))}
          {/* The candidate's own words, quoted — the deterministic half of
              the feedback, so the quote is guaranteed to be verbatim. */}
          {languageNotes.map((note) => (
            <li
              key={note.marker + note.reading}
              className="flex gap-1.5 text-slate-500"
            >
              <Quote className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                &ldquo;{note.marker}&rdquo; — {note.reading}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
