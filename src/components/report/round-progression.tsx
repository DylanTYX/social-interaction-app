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
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
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
            <span className="text-sm font-semibold text-slate-500 tabular-nums">
              {point.score ?? "—"}
            </span>
            {/* Every bar in blue, like every chart in the app; the height is
                the comparison. A three-colour ramp made the middle band blue
                and the low band amber, which contradicted the two-band reading
                the per-answer scores use. */}
            <div
              className={`w-full rounded-t-md ${
                typeof point.score === "number" ? "bg-primary" : "bg-slate-200"
              }`}
              style={{ height: `${height}px` }}
            />
            <span className="line-clamp-2 w-full text-center text-xs leading-tight text-slate-500">
              {point.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
