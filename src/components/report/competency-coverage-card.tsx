import { Check, Circle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  COMPETENCIES,
  coveragePercent,
  type CompetencyCoverage,
} from "@/lib/competencies";

/**
 * Which competencies this interview actually explored.
 *
 * The gaps are the useful half: a session can score well while never touching
 * conflict, failure, or ambiguity, and knowing that is what tells the
 * candidate what to practise next.
 */
export function CompetencyCoverageCard({
  coverage,
}: {
  coverage: CompetencyCoverage;
}) {
  const total = COMPETENCIES.length;
  const coveredCount = Object.keys(coverage.covered).length;

  if (coveredCount === 0) {
    // Pre-existing sessions have no coverage recorded; saying nothing is
    // better than implying every competency was missed.
    return null;
  }

  const percent = coveragePercent(coverage);

  return (
    <Card className="border-slate-200/80 bg-white">
      <CardHeader>
        <CardTitle className="text-base">Competency coverage</CardTitle>
        <CardDescription>
          {coveredCount} of {total} competencies were explored in this
          interview. The untouched ones are what to practise next.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Explored</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {percent}%
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
            role="img"
            aria-label={`${coveredCount} of ${total} competencies explored`}
          >
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </div>
        </div>

        <ul className="grid gap-1.5 sm:grid-cols-2">
          {COMPETENCIES.map((competency) => {
            const isCovered = competency.id in coverage.covered;
            return (
              <li
                key={competency.id}
                className={`flex items-start gap-2 text-sm ${
                  isCovered ? "text-slate-900" : "text-slate-400"
                }`}
                title={competency.summary}
              >
                {isCovered ? (
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="mt-0.5 h-4 w-4 shrink-0 text-slate-300"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {competency.label}
                  <span className="sr-only">
                    {isCovered ? " — explored" : " — not explored"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
