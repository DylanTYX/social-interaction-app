"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompetencyHistory } from "@/lib/competencies";
import { cn } from "@/lib/utils";

/**
 * What you have and have not been asked about, across every session.
 *
 * The per-session report has always shown coverage for that interview, which
 * answers "did this one touch delegation?" — not the question someone
 * preparing for a real interview has, which is "what have I still never been
 * asked?" Coverage was already recorded on every session and already travelled
 * in the list this page fetches; it was just never read more than one session
 * at a time.
 *
 * Sorted rarest-first because the bottom of the list is the useful end. Blind
 * spots come first and are the only rows given any colour.
 */

/** Below this a competency counts as a blind spot rather than light practice. */
const RARE_THRESHOLD = 1;

export function CompetencyHistoryCard({
  history,
  totalSessions,
}: {
  history: CompetencyHistory[];
  totalSessions: number;
}) {
  const neverPractised = history.filter((entry) => entry.sessions === 0);
  const busiest = history[history.length - 1]?.sessions ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Competency coverage</CardTitle>
        <p className="text-sm text-gray-500">
          {totalSessions === 0
            ? "Once you have practised, this shows which competencies you have and have not been asked about."
            : neverPractised.length > 0
              ? `${neverPractised.length} of ${history.length} competencies have not come up yet across your ${totalSessions} session${totalSessions === 1 ? "" : "s"}.`
              : `All ${history.length} competencies have come up across your ${totalSessions} sessions.`}
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {history.map(({ competency, sessions }) => {
            const isBlindSpot = sessions === 0;
            const isRare = sessions <= RARE_THRESHOLD && !isBlindSpot;
            // Relative to the most-practised competency, so the bars compare
            // against each other rather than against an arbitrary maximum.
            const width = busiest > 0 ? (sessions / busiest) * 100 : 0;

            return (
              <li key={competency.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span
                    className={cn(
                      "truncate",
                      isBlindSpot
                        ? "font-medium text-amber-700"
                        : "text-gray-700",
                    )}
                  >
                    {competency.label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      isBlindSpot ? "text-amber-700" : "text-gray-500",
                    )}
                  >
                    {isBlindSpot
                      ? "not yet"
                      : `${sessions} session${sessions === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      isRare ? "bg-amber-400" : "bg-blue-500",
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
