interface Point {
  label: string;
  score: number | null;
}

/**
 * Score progression across the rounds of an interview loop.
 *
 * A small bar chart rather than a line: rounds are discrete and scored against
 * *different* rubrics, so connecting them with a line would imply a continuity
 * that is not there. Height still carries the comparison.
 */
export function RoundProgression({ points }: { points: Point[] }) {
  const scored = points.filter(
    (p): p is Point & { score: number } => typeof p.score === "number",
  );

  if (scored.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        No rounds scored yet.
      </div>
    );
  }

  return (
    <div
      className="flex items-end gap-3 overflow-x-auto pb-2"
      role="img"
      aria-label={`Score by round: ${scored
        .map((p) => `${p.label} ${p.score}`)
        .join(", ")}`}
    >
      {points.map((point, index) => {
        const height =
          typeof point.score === "number"
            ? Math.max(4, Math.round((point.score / 100) * 128))
            : 4;

        return (
          <div
            key={`${point.label}-${index}`}
            className="flex min-w-16 flex-1 flex-col items-center gap-1.5"
          >
            <span className="text-sm font-semibold tabular-nums text-slate-700">
              {point.score ?? "—"}
            </span>
            <div
              className={`w-full rounded-t-md ${
                typeof point.score === "number"
                  ? point.score >= 75
                    ? "bg-emerald-500"
                    : point.score >= 55
                      ? "bg-blue-500"
                      : "bg-amber-500"
                  : "bg-slate-200"
              }`}
              style={{ height: `${height}px` }}
            />
            <span className="max-w-24 truncate text-xs text-slate-500">
              {point.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
