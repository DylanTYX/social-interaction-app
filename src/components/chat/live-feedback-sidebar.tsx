import { PANEL_LABEL } from "@/components/dashboard/page-header";
import type { InterviewMetrics } from "@/lib/interview-metrics";
import type { PracticeMode } from "@/lib/interview-setup";
import type { AnalysisResult } from "@/lib/response-analyzer";
import type { DeliverySnapshot } from "@/lib/session-launch-meta";
import { cn } from "@/lib/utils";

type LiveFeedbackSidebarProps = {
  metrics: InterviewMetrics | null;
  analyses: AnalysisResult[];
  followupPrompt: string | null;
  /** One line on how the interview is trending, from the page's metric read. */
  trendNote?: string | null;
  /** Decides the third measure: speaking pace when spoken, answer length when typed. */
  mode: PracticeMode;
  /** The spoken answers' delivery, one per scored answer. Unused in text. */
  delivery?: DeliverySnapshot[];
};

export type MetricChip = {
  key: string;
  label: string;
  value: number | null;
  unit: "%" | "wpm" | "words";
  /** Plotted on a 0–100 scale; see the chart ceilings below. */
  trend: number[];
};

/*
 * Sparkline ceilings for the two measures that carry a unit. Fixed rather than
 * fitted to the data, so a change of ten words a minute looks like ten words a
 * minute. 250 wpm sits well past the fast band (`PACE_BANDS.fastAbove`).
 */
const PACE_CHART_MAX_WPM = 250;
const LENGTH_CHART_MAX_WORDS = 200;

export type CoachingItem = {
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

function getMetricTrend(values: number[], maxPoints = 7): number[] {
  if (values.length === 0) {
    return [];
  }

  const bounded = values.map((value) => clamp(value));
  return bounded.slice(Math.max(0, bounded.length - maxPoints));
}

export function getCoachingItems(
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

/**
 * The rail's four measures.
 *
 * The third was "Speaking pace", scored by how close an answer's word count
 * came to 95 — so it measured length, reported a pace for typed answers, and
 * could contradict the real pace printed under a spoken answer. It now shows
 * what it names: words a minute from the speech itself when you speak, and the
 * answer's length in words when you type.
 */
export function buildMetricChips(
  metrics: InterviewMetrics | null,
  analyses: AnalysisResult[],
  mode: PracticeMode = "text",
  delivery: DeliverySnapshot[] = [],
): MetricChip[] {
  const confidenceSeries = analyses.map(
    (analysis) => analysis.confidenceIndicators.assertivenessScore * 10,
  );
  const relevanceSeries = analyses.map((analysis) =>
    analysis.responseQuality.isRelevant ? 90 : 50,
  );
  const paceSeries = delivery.flatMap((snapshot) =>
    snapshot.wpm === null ? [] : [snapshot.wpm],
  );
  const lengthSeries = analyses.map((analysis) => analysis.responseQuality.length);
  const conciseSeries = analyses.map(
    (analysis) => (10 - analysis.specificityMetrics.vaguenessScore) * 10,
  );

  return [
    {
      key: "confidence",
      label: "Confidence",
      unit: "%",
      value:
        metrics && analyses.length > 0
          ? clamp(metrics.averageConfidenceScore * 10)
          : null,
      trend: getMetricTrend(confidenceSeries),
    },
    {
      key: "relevance",
      label: "Relevance",
      unit: "%",
      value:
        relevanceSeries.length > 0
          ? relevanceSeries[relevanceSeries.length - 1]
          : null,
      trend: getMetricTrend(relevanceSeries),
    },
    mode === "voice"
      ? {
          key: "pace",
          label: "Speaking pace",
          value: paceSeries.length > 0 ? paceSeries[paceSeries.length - 1] : null,
          unit: "wpm",
          trend: getMetricTrend(
            paceSeries.map((wpm) => (wpm / PACE_CHART_MAX_WPM) * 100),
          ),
        }
      : {
          key: "length",
          label: "Answer length",
          value:
            lengthSeries.length > 0 ? lengthSeries[lengthSeries.length - 1] : null,
          unit: "words",
          trend: getMetricTrend(
            lengthSeries.map((words) => (words / LENGTH_CHART_MAX_WORDS) * 100),
          ),
        },
    {
      key: "concise",
      label: "Conciseness",
      unit: "%",
      value:
        conciseSeries.length > 0
          ? conciseSeries[conciseSeries.length - 1]
          : null,
      trend: getMetricTrend(conciseSeries),
    },
  ];
}

function formatMetric(metric: MetricChip): string {
  if (metric.value === null) return "—";
  const value = Math.round(metric.value);
  return metric.unit === "%" ? `${value}%` : `${value} ${metric.unit}`;
}

/** Good is green, needs attention is amber, a focus is neutral. */
const TONE_MARK: Record<CoachingItem["tone"], string> = {
  good: "bg-success",
  warn: "bg-warning",
  focus: "bg-slate-300",
};

/**
 * The live coaching rail: four measures with their recent trend, and up to
 * four notes on the last answer.
 *
 * It used to be a frosted glass panel holding four gradient tiles, each in
 * its own colour, over four tinted cards that slid in one after another. The
 * colours told the metrics apart, which their labels already did, and the
 * gradients and glass were the exact decoration the design rules out. Now it
 * is one bordered panel: a hairline grid of measures, each drawn in blue like
 * every chart in the app, and one hairline-divided list of notes. The only
 * colour is the mark beside a note, and it means something: green is good,
 * amber needs attention. See docs/DESIGN.md.
 */
export function LiveFeedbackSidebar({
  metrics,
  analyses,
  followupPrompt,
  trendNote,
  mode,
  delivery,
}: LiveFeedbackSidebarProps) {
  const metricChips = buildMetricChips(metrics, analyses, mode, delivery);
  const coachingItems = getCoachingItems(analyses, followupPrompt);

  return (
    <aside className="flex max-h-full w-full shrink-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white xl:w-104">
      <div className="border-b border-slate-100 px-4 py-3.5">
        <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">
          Live coaching
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {trendNote ?? "Notes appear after each answer."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100">
        {metricChips.map((metric) => {
          const sparkPath = buildSparklinePath(metric.trend);
          return (
            <div key={metric.key} className="bg-white p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-slate-500">{metric.label}</span>
                <span className="font-display text-base font-semibold whitespace-nowrap text-navy tabular-nums">
                  {formatMetric(metric)}
                </span>
              </div>
              {metric.value === null ? (
                <p className="mt-2 h-7 text-[11px] leading-7 text-slate-400">
                  No answers yet
                </p>
              ) : (
                <svg
                  viewBox="0 0 84 26"
                  className="mt-2 h-7 w-full text-primary"
                  role="img"
                  aria-label={`${metric.label} trend`}
                >
                  {[0, 13, 26].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="84"
                      y2={y}
                      className="stroke-slate-100"
                      strokeWidth="1"
                    />
                  ))}
                  <path
                    d={sparkPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 pt-3.5 pb-1">
        <p className={PANEL_LABEL}>Notes on your last answer</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {coachingItems.map((item) => (
          <li key={item.id} className="px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-[2px]",
                  TONE_MARK[item.tone],
                )}
                aria-hidden
              />
              {item.title}
            </p>
            <p className="mt-1 pl-4 text-xs leading-5 text-slate-600">
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
