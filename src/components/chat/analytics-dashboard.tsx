import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InterviewMetrics } from "@/lib/metricsTracker";
import type { AnalysisResult, InterviewStrategy } from "@/lib/responseAnalyzer";

type AnalyticsDashboardProps = {
  analyses: AnalysisResult[];
  strategyHistory: InterviewStrategy[];
  metrics: InterviewMetrics | null;
};

const STRATEGY_LABELS: Record<InterviewStrategy, string> = {
  CLARIFY_SITUATION: "Clarify Situation",
  PROBE_ACTION: "Probe Action",
  CHALLENGE_OWNERSHIP: "Challenge Ownership",
  EXPLORE_RESULT: "Explore Result",
  ACKNOWLEDGE_STRENGTH: "Acknowledge Strength",
  DRILL_SPECIFICITY: "Drill Specificity",
  ASSESS_THINKING: "Assess Thinking",
};

function getAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildStarAverages(analyses: AnalysisResult[]) {
  return {
    situation: getAverage(
      analyses.map((analysis) => analysis.starAnalysis.situation.quality),
    ),
    task: getAverage(
      analyses.map((analysis) => analysis.starAnalysis.task.quality),
    ),
    action: getAverage(
      analyses.map((analysis) => analysis.starAnalysis.action.quality),
    ),
    result: getAverage(
      analyses.map((analysis) => analysis.starAnalysis.result.quality),
    ),
  };
}

function buildRadarPoints(values: number[]) {
  const center = 72;
  const radius = 52;
  const angles = values.map(
    (_, index) => -Math.PI / 2 + (index * (Math.PI * 2)) / values.length,
  );

  return values
    .map((value, index) => {
      const normalized = Math.max(0, Math.min(10, value)) / 10;
      const pointRadius = radius * normalized;
      const x = center + Math.cos(angles[index]) * pointRadius;
      const y = center + Math.sin(angles[index]) * pointRadius;
      return `${x},${y}`;
    })
    .join(" ");
}

function getLinePoints(values: number[], width = 320, height = 130) {
  if (values.length === 0) {
    return { path: "", dots: [] as Array<{ x: number; y: number }> };
  }

  const max = 100;
  const stepX = values.length === 1 ? 0 : width / (values.length - 1);
  const dots = values.map((value, index) => ({
    x: index * stepX,
    y: height - (Math.max(0, Math.min(max, value)) / max) * height,
  }));

  const path = dots
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  return { path, dots };
}

function getStrategyCounts(strategyHistory: InterviewStrategy[]) {
  return Object.keys(STRATEGY_LABELS).map((strategy) => ({
    strategy: strategy as InterviewStrategy,
    label: STRATEGY_LABELS[strategy as InterviewStrategy],
    count: strategyHistory.filter((item) => item === strategy).length,
  }));
}

function MiniPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
      {title}
    </div>
  );
}

export function AnalyticsDashboard({
  analyses,
  strategyHistory,
  metrics,
}: AnalyticsDashboardProps) {
  const overallScores = analyses.map((analysis) => analysis.overallScore);
  const starValues = buildStarAverages(analyses);
  const radarValues = [
    starValues.situation,
    starValues.task,
    starValues.action,
    starValues.result,
  ];
  const lineData = getLinePoints(overallScores);
  const strategyCounts = getStrategyCounts(strategyHistory);
  const maxStrategyCount = Math.max(
    1,
    ...strategyCounts.map((entry) => entry.count),
  );

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-soft dark:border-slate-800 dark:bg-slate-950/60">
      <CardHeader>
        <CardTitle className="text-sm">Interview Analytics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {metrics ? Math.round(metrics.averageOverallScore) : "--"}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Overall score
            </div>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {metrics ? `${Math.round(metrics.averageSTARScore * 10)}%` : "--"}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              STAR quality
            </div>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <div className="text-lg font-semibold capitalize text-slate-900 dark:text-slate-100">
              {metrics ? metrics.improvementTrend : "--"}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Trend
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                STAR Radar
              </div>
              <Badge variant="secondary" className="text-xs">
                S/T/A/R
              </Badge>
            </div>
            {analyses.length === 0 ? (
              <MiniPlaceholder title="Radar chart appears after the first scored response." />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40">
                <svg viewBox="0 0 144 144" className="h-40 w-full">
                  {[0.2, 0.4, 0.6, 0.8, 1].map((level) => {
                    const points = [
                      [72, 72 - 52 * level],
                      [72 + 52 * level, 72],
                      [72, 72 + 52 * level],
                      [72 - 52 * level, 72],
                    ]
                      .map(([x, y]) => `${x},${y}`)
                      .join(" ");

                    return (
                      <polygon
                        key={level}
                        points={points}
                        fill="none"
                        stroke="#d6ddeb"
                        strokeWidth="1"
                      />
                    );
                  })}
                  {[
                    [72, 20],
                    [124, 72],
                    [72, 124],
                    [20, 72],
                  ].map(([x, y], index) => (
                    <line
                      key={index}
                      x1="72"
                      y1="72"
                      x2={x}
                      y2={y}
                      stroke="#d6ddeb"
                      strokeWidth="1"
                    />
                  ))}
                  <polygon
                    points={buildRadarPoints(radarValues)}
                    fill="rgba(14, 116, 144, 0.16)"
                    stroke="#0e7490"
                    strokeWidth="2"
                  />
                  {[
                    { label: "S", x: 72, y: 12 },
                    { label: "T", x: 132, y: 72 },
                    { label: "A", x: 72, y: 136 },
                    { label: "R", x: 12, y: 72 },
                  ].map((point) => (
                    <text
                      key={point.label}
                      x={point.x}
                      y={point.y}
                      textAnchor="middle"
                      className="fill-slate-600 text-[10px] font-medium"
                    >
                      {point.label}
                    </text>
                  ))}
                </svg>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Score Timeline
              </div>
              <Badge variant="secondary" className="text-xs">
                Question-by-question
              </Badge>
            </div>
            {analyses.length === 0 ? (
              <MiniPlaceholder title="Timeline appears as responses are scored." />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40">
                <svg viewBox="0 0 320 130" className="h-36 w-full">
                  <line
                    x1="0"
                    y1="130"
                    x2="320"
                    y2="130"
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <path
                    d={lineData.path}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="2.5"
                  />
                  {lineData.dots.map((dot, index) => (
                    <circle
                      key={index}
                      cx={dot.x}
                      cy={dot.y}
                      r="3.5"
                      fill="#0ea5e9"
                    />
                  ))}
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Strategy Frequency
            </div>
            <Badge variant="secondary" className="text-xs">
              Adaptive mix
            </Badge>
          </div>
          {strategyHistory.length === 0 ? (
            <MiniPlaceholder title="Strategy distribution appears after analysis starts." />
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
              {strategyCounts.map((entry) => (
                <div key={entry.strategy} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span>{entry.label}</span>
                    <span>{entry.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-sky-600"
                      style={{
                        width: `${(entry.count / maxStrategyCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Question-by-Question Breakdown
          </div>
          {analyses.length === 0 ? (
            <MiniPlaceholder title="Per-question breakdown appears after responses are analyzed." />
          ) : (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40">
              {analyses.map((analysis, index) => (
                <div
                  key={`${analysis.overallScore}-${index}`}
                  className="grid gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 sm:grid-cols-5"
                >
                  <p>Q{index + 1}</p>
                  <p>Score: {Math.round(analysis.overallScore)}%</p>
                  <p>
                    Relevance:{" "}
                    {analysis.responseQuality.isRelevant
                      ? "Strong"
                      : "Needs work"}
                  </p>
                  <p>Depth: {analysis.responseQuality.depthLevel}</p>
                  <p>
                    STAR:{" "}
                    {Math.round(
                      (analysis.starAnalysis.action.quality / 10) * 100,
                    )}
                    %
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
