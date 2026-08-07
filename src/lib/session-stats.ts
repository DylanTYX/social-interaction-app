import type { InterviewSessionSummary } from "@/hooks/use-interview-history";

/**
 * The headline numbers derived from a session list.
 *
 * There were two implementations of this — `computeStats` on the dashboard home
 * and `buildModel` on the analytics page — computing the same three figures from
 * the same array, with the same icons and the same accent colours next to them.
 * They had already drifted: `computeStats` rounded the average inside the
 * calculation while `buildModel` rounded at display, and zero practice time
 * printed as "0m" on one page and "0 min" on the other.
 *
 * Two copies of a metric is one metric and one liability. This is the metric.
 *
 * Rounding is deliberately *not* done here — a mean is a mean, and a caller
 * that wants one decimal place should not have to undo someone else's
 * `Math.round`.
 */

/**
 * How many sessions the headline figures are computed over.
 *
 * Home fetched 25 and captioned the result "All time"; analytics fetched 50 and
 * captioned it "Across N days". The same three metrics, two different windows,
 * both described as totals. 100 is the server's own cap
 * (`api/sessions/route.ts`, `parseLimit … max: 100`), so this is as close to
 * "all" as the endpoint permits — and `describeStatsWindow` below stops the
 * caption claiming more than that.
 */
export const STATS_WINDOW = 100;

/**
 * An honest label for the window the figures cover.
 *
 * Self-correcting: while a user is under the cap "All time" is simply true, and
 * the moment they saturate it the caption stops saying so.
 */
export function describeStatsWindow(total: number): string {
  return total >= STATS_WINDOW ? `Last ${STATS_WINDOW} sessions` : "All time";
}

export interface SessionStats {
  total: number;
  /** Sessions carrying a numeric score, i.e. ones that were actually graded. */
  completed: number;
  /** Unrounded mean of scored sessions, or `null` when nothing is scored. */
  averageScore: number | null;
  bestScore: number | null;
  totalMinutes: number;
  voiceCount: number;
  textCount: number;
}

function scoredOnly(
  sessions: readonly InterviewSessionSummary[],
): Array<InterviewSessionSummary & { averageScore: number }> {
  return sessions.filter(
    (entry): entry is InterviewSessionSummary & { averageScore: number } =>
      typeof entry.averageScore === "number",
  );
}

export function computeSessionStats(
  sessions: readonly InterviewSessionSummary[],
): SessionStats {
  const scored = scoredOnly(sessions);
  const voiceCount = sessions.filter(
    (entry) => entry.practiceMode === "voice",
  ).length;

  return {
    total: sessions.length,
    completed: scored.length,
    averageScore:
      scored.length > 0
        ? scored.reduce((sum, entry) => sum + entry.averageScore, 0) /
          scored.length
        : null,
    bestScore:
      scored.length > 0
        ? scored.reduce((max, entry) => Math.max(max, entry.averageScore), 0)
        : null,
    totalMinutes: sessions.reduce(
      (sum, entry) => sum + (entry.durationMinutes ?? 0),
      0,
    ),
    voiceCount,
    textCount: sessions.length - voiceCount,
  };
}

/**
 * Practice time, formatted once.
 *
 * The home page printed `0m` and analytics printed `0 min` for the same zero —
 * the visible symptom of the same number being computed in two places.
 */
export function formatPracticeMinutes(total: number): string {
  if (total <= 0) return "0 min";
  if (total < 60) return `${Math.round(total)} min`;
  return `${(total / 60).toFixed(1)}h`;
}

/** The average as a percentage string, or an em dash when nothing is scored. */
export function formatAverageScore(averageScore: number | null): string {
  return averageScore === null ? "—" : `${Math.round(averageScore)}%`;
}
