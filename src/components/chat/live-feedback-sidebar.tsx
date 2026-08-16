import { Activity, MessageCircleHeart, Timer, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InterviewMetrics } from "@/lib/interview-metrics";
import type { AnalysisResult } from "@/lib/response-analyzer";

type LiveFeedbackSidebarProps = {
  metrics: InterviewMetrics | null;
  analyses: AnalysisResult[];
  followupPrompt: string | null;
};

type MetricChip = {
  key: string;
  label: string;
  value: number | null;
  tone: "emerald" | "blue" | "amber" | "violet";
  trend: number[];
  icon: React.ComponentType<{ className?: string }>;
};

type CoachingItem = {
  id: string;
  title: string;
  body: string;
  tone: "good" | "warn" | "focus";
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function buildSparklinePath(values: number[]): string {
  if (values.length === 0) {
    return "";
  }

  const width = 84;
  const height = 26;
  const stepX = values.length === 1 ? 0 : width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (clamp(value) / 100) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildGridLines(width = 84, height = 26) {
  return {
    vertical: [0, width / 2, width],
    horizontal: [0, height / 2, height],
  };
}

function getMetricTrend(values: number[], maxPoints = 7): number[] {
  if (values.length === 0) {
    return [];
  }

  const bounded = values.map((value) => clamp(value));
  return bounded.slice(Math.max(0, bounded.length - maxPoints));
}

function getCoachingItems(
  analyses: AnalysisResult[],
  followupPrompt: string | null,
): CoachingItem[] {
  const latest = analyses[analyses.length - 1];

  if (!latest) {
    return [
      {
        id: "start",
        title: "Start with concrete context",
        body: "Open with situation + task in 1-2 lines before describing your action.",
        tone: "focus",
      },
      {
        id: "structure",
        title: "Use STAR pacing",
        body: "Keep the answer structured and avoid jumping straight to outcomes.",
        tone: "good",
      },
    ];
  }

  const items: CoachingItem[] = [];

  if (!latest.responseQuality.isRelevant) {
    items.push({
      id: "relevance",
      title: "Bring it back to the question",
      body: "Your answer is drifting. Anchor your next sentence to the interviewer prompt.",
      tone: "warn",
    });
  }

  if (latest.starAnalysis.action.specificity < 6) {
    items.push({
      id: "specificity",
      title: "Add one concrete example",
      body: "Describe a specific decision you made, not just the team activity.",
      tone: "focus",
    });
  }

  if (!latest.starAnalysis.result.quantified) {
    items.push({
      id: "impact",
      title: "Mention measurable impact",
      body: "Add numbers, timelines, or quality metrics to strengthen your result.",
      tone: "focus",
    });
  }

  if (latest.confidenceIndicators.hesitationMarkers > 2) {
    items.push({
      id: "pace",
      title: "Slow down and commit",
      body: "Reduce hedge words like 'maybe' and use confident, direct statements.",
      tone: "warn",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "strong",
      title: "Great structure",
      body: "Strong answer. Keep this level of specificity while tightening conciseness.",
      tone: "good",
    });
  }

  if (followupPrompt) {
    items.push({
      id: "adaptive",
      title: "Likely next focus",
      body: followupPrompt,
      tone: "focus",
    });
  }

  return items.slice(0, 4);
}

function buildMetricChips(
  metrics: InterviewMetrics | null,
  analyses: AnalysisResult[],
): MetricChip[] {
  const confidenceSeries = analyses.map(
    (analysis) => analysis.confidenceIndicators.assertivenessScore * 10,
  );
  const relevanceSeries = analyses.map((analysis) =>
    analysis.responseQuality.isRelevant ? 90 : 50,
  );
  const paceSeries = analyses.map((analysis) => {
    const distance = Math.abs(analysis.responseQuality.length - 95);
    return clamp(100 - distance, 38, 100);
  });
  const conciseSeries = analyses.map(
    (analysis) => (10 - analysis.specificityMetrics.vaguenessScore) * 10,
  );

  return [
    {
      key: "confidence",
      label: "Confidence",
      value:
        metrics && analyses.length > 0
          ? clamp(metrics.averageConfidenceScore * 10)
          : null,
      tone: "blue",
      trend: getMetricTrend(confidenceSeries),
      icon: MessageCircleHeart,
    },
    {
      key: "relevance",
      label: "Relevance",
      value:
        relevanceSeries.length > 0
          ? relevanceSeries[relevanceSeries.length - 1]
          : null,
      tone: "emerald",
      trend: getMetricTrend(relevanceSeries),
      icon: TrendingUp,
    },
    {
      key: "pace",
      label: "Speaking pace",
      value: paceSeries.length > 0 ? paceSeries[paceSeries.length - 1] : null,
      tone: "amber",
      trend: getMetricTrend(paceSeries),
      icon: Timer,
    },
    {
      key: "concise",
      label: "Conciseness",
      value:
        conciseSeries.length > 0
          ? conciseSeries[conciseSeries.length - 1]
          : null,
      tone: "violet",
      trend: getMetricTrend(conciseSeries),
      icon: Activity,
    },
  ];
}

function toneStyles(tone: MetricChip["tone"]): string {
  if (tone === "emerald") {
    return "from-success/20 to-success/5 border-success-border/50 text-success-emphasis";
  }

  if (tone === "amber") {
    return "from-warning/20 to-warning/5 border-warning-border/50 text-warning-emphasis";
  }

  if (tone === "violet") {
    return "from-primary/20 to-primary/5 border-primary-border/50 text-primary-emphasis";
  }

  return "from-primary/20 to-primary/5 border-primary-border/50 text-primary-emphasis";
}

function coachingToneStyle(tone: CoachingItem["tone"]): string {
  if (tone === "warn") {
    return "border-warning-border/60 bg-warning-subtle/70";
  }

  if (tone === "good") {
    return "border-success-border/60 bg-success-subtle/70";
  }

  return "border-primary-border/60 bg-primary-subtle/70";
}

export function LiveFeedbackSidebar({
  metrics,
  analyses,
  followupPrompt,
}: LiveFeedbackSidebarProps) {
  const metricChips = buildMetricChips(metrics, analyses);
  const coachingItems = getCoachingItems(analyses, followupPrompt);

  return (
    <aside className="flex max-h-full w-full shrink-0 flex-col overflow-y-auto rounded-2xl border border-slate-200/70 bg-white/65 p-4 shadow-soft-md backdrop-blur-xl xl:w-104">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Live Coaching
          </h2>
          <p className="text-xs text-slate-500">
            Real-time nudges during the interview
          </p>
        </div>
        <Badge variant="secondary" className="animate-pulse">
          Live
        </Badge>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3">
        {metricChips.map((metric) => {
          const Icon = metric.icon;
          const sparkPath = buildSparklinePath(metric.trend);
          const grid = buildGridLines();

          return (
            <Card
              key={metric.key}
              className={`border bg-linear-to-br shadow-soft transition-all duration-300 hover:-translate-y-0.5 ${toneStyles(metric.tone)}`}
            >
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {metric.label}
                  </span>
                  <span>
                    {metric.value === null
                      ? "--"
                      : `${Math.round(metric.value)}%`}
                  </span>
                </div>
                {metric.value === null ? (
                  <div className="flex h-7 items-center justify-center rounded-md border border-dashed border-slate-200/70 text-[10px] text-muted-foreground">
                    No samples yet
                  </div>
                ) : (
                  <svg
                    viewBox="0 0 84 26"
                    className="h-7 w-full"
                    role="img"
                    aria-label={`${metric.label} trend`}
                  >
                    {grid.vertical.map((x) => (
                      <line
                        key={`v-${x}`}
                        x1={x}
                        y1="0"
                        x2={x}
                        y2="26"
                        stroke="currentColor"
                        strokeOpacity="0.12"
                        strokeWidth="0.8"
                      />
                    ))}
                    {grid.horizontal.map((y) => (
                      <line
                        key={`h-${y}`}
                        x1="0"
                        y1={y}
                        x2="84"
                        y2={y}
                        stroke="currentColor"
                        strokeOpacity="0.12"
                        strokeWidth="0.8"
                      />
                    ))}
                    <path
                      d={sparkPath}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 space-y-2.5 pb-2">
        {coachingItems.map((item, index) => (
          // The stagger was here already but had nothing to stagger: this set
          // `animationDelay` on a card with no `animation` property, so the
          // delay was inert and the cards all appeared at once. Adding the
          // entrance makes the existing intent real. `fill-mode-both` is what
          // keeps a delayed card hidden until its turn instead of flashing in
          // and restarting.
          <Card
            key={item.id}
            className={`gap-2 border shadow-soft transition-all duration-500 animate-in fade-in-0 slide-in-from-right-2 ease-soft fill-mode-both ${coachingToneStyle(item.tone)}`}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <CardHeader className="pb-1.5">
              <CardTitle className="text-sm font-semibold text-slate-900">
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs leading-5 text-slate-600">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </aside>
  );
}
