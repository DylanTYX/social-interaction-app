"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import {
  TrendingUp,
  Clock,
  Target,
  Mic,
  MessageSquare,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  computeSessionStats,
  formatAverageScore,
  formatPracticeMinutes,
  STATS_WINDOW,
} from "@/lib/session-stats";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import {
  parseSessionMetrics,
  type DimensionSnapshot,
} from "@/lib/session-launch-meta";
import {
  useInterviewHistory,
  type InterviewSessionSummary,
} from "@/hooks/use-interview-history";
import { TILE_COLORS } from "@/lib/tile-colors";

interface ScenarioBucket {
  title: string;
  count: number;
  averageScore: number | null;
}

type DimensionMetricKey = "clarity" | "specificity" | "confidence" | "star";

interface DimensionSeries {
  key: DimensionMetricKey;
  label: string;
  color: string;
  values: number[];
}

interface AnalyticsModel {
  total: number;
  completed: number;
  averageScore: number | null;
  bestScore: number | null;
  totalMinutes: number;
  voiceCount: number;
  textCount: number;
  trend: { id: string; score: number }[];
  scenarioBuckets: ScenarioBucket[];
  daysActive: number;
  dimensionSeries: DimensionSeries[];
}

function buildModel(sessions: InterviewSessionSummary[]): AnalyticsModel {
  // The headline figures come from the shared function. This page used to
  // recompute total / average / best / minutes / mode-mix itself, alongside an
  // identical copy on the dashboard home — same numbers, same icons, same
  // accent colours, two implementations that had already drifted on rounding
  // and on how they printed zero.
  const {
    total,
    completed,
    averageScore,
    bestScore,
    totalMinutes,
    voiceCount,
    textCount,
  } = computeSessionStats(sessions);

  // Everything below is analytics-only: the trend line, per-scenario buckets
  // and skill dimensions have no second home to drift from.
  const scoredSessions = sessions
    .filter(
      (entry): entry is InterviewSessionSummary & { averageScore: number } =>
        typeof entry.averageScore === "number",
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const trend = scoredSessions.slice(-15).map((entry) => ({
    id: entry.id,
    score: entry.averageScore,
  }));

  const scenarioMap = new Map<string, { scores: number[]; count: number }>();
  for (const entry of sessions) {
    const key = entry.scenarioTitle ?? entry.scenarioValue;
    const bucket = scenarioMap.get(key) ?? { scores: [], count: 0 };
    bucket.count += 1;
    if (typeof entry.averageScore === "number") {
      bucket.scores.push(entry.averageScore);
    }
    scenarioMap.set(key, bucket);
  }

  const scenarioBuckets: ScenarioBucket[] = Array.from(scenarioMap.entries())
    .map(([title, bucket]) => ({
      title,
      count: bucket.count,
      averageScore:
        bucket.scores.length > 0
          ? bucket.scores.reduce((sum, value) => sum + value, 0) /
            bucket.scores.length
          : null,
    }))
    .sort((a, b) => b.count - a.count);

  const days = new Set<string>();
  for (const entry of sessions) {
    const ts = Date.parse(entry.createdAt);
    if (!Number.isNaN(ts)) {
      days.add(new Date(ts).toDateString());
    }
  }

  const dimensionSnapshots: DimensionSnapshot[] = [];
  for (const entry of sessions) {
    const metrics = parseSessionMetrics(entry.metrics ?? null);
    if (metrics.dimensionSnapshots) {
      dimensionSnapshots.push(...metrics.dimensionSnapshots);
    }
  }
  dimensionSnapshots.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const recentDimensions = dimensionSnapshots.slice(-20);

  const dimensionDefs: Omit<DimensionSeries, "values">[] = [
    { key: "clarity", label: "Clarity", color: "#2563eb" },
    { key: "specificity", label: "Specificity", color: "#7c3aed" },
    { key: "confidence", label: "Confidence", color: "#0d9488" },
    { key: "star", label: "STAR structure", color: "#ea580c" },
  ];
  const dimensionSeries: DimensionSeries[] = dimensionDefs.map((series) => ({
    ...series,
    values: recentDimensions.map((point) => point[series.key]),
  }));

  return {
    total,
    completed,
    averageScore,
    bestScore,
    totalMinutes,
    voiceCount,
    textCount,
    trend,
    scenarioBuckets,
    daysActive: days.size,
    dimensionSeries,
  };
}

/**
 * Scored sessions before a trend line is drawn at all.
 *
 * Every chart on this page used to render at two points, which is a pair of
 * readings dressed as a direction — and the recommendations built on top of
 * them called a bucket a weakness off a single session.
 */
const MIN_POINTS_FOR_TREND = 4;

function ScoreSparkline({
  points,
}: {
  points: { id: string; score: number }[];
}) {
  /**
   * Four, not two. A line through two points is not a trend, it is a pair of
   * readings — and drawing one invites the user to read a direction into a
   * sample that cannot support one.
   */
  if (points.length < MIN_POINTS_FOR_TREND) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 text-center text-sm text-gray-500">
        {points.length === 0
          ? "Complete a few scored sessions to see how you are tracking."
          : `${points.length} scored session${points.length === 1 ? "" : "s"} so far — ${MIN_POINTS_FOR_TREND} shows a trend.`}
      </div>
    );
  }

  const width = 720;
  const height = 160;
  const padding = { top: 16, right: 16, bottom: 24, left: 32 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxScore = 100;
  const minScore = 0;

  const stepX = points.length === 1 ? 0 : innerW / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = padding.left + index * stepX;
    const y =
      padding.top +
      innerH -
      ((point.score - minScore) / (maxScore - minScore)) * innerH;
    return { x, y, score: point.score };
  });

  const linePath = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${
    padding.top + innerH
  } L ${coords[0].x} ${padding.top + innerH} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-40 w-full"
      role="img"
      aria-label="Score trend over time"
    >
      {[0, 25, 50, 75, 100].map((value) => {
        const y =
          padding.top +
          innerH -
          ((value - minScore) / (maxScore - minScore)) * innerH;
        return (
          <g key={value}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text
              x={padding.left - 6}
              y={y + 3}
              textAnchor="end"
              fontSize="10"
              fill="#9ca3af"
            >
              {value}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="rgba(59, 130, 246, 0.12)" />
      <path
        d={linePath}
        fill="none"
        stroke="#2563eb"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((coord, index) => (
        <circle
          key={index}
          cx={coord.x}
          cy={coord.y}
          r={3}
          fill="#2563eb"
          stroke="#fff"
          strokeWidth={1.5}
        >
          <title>{`Session ${index + 1}: ${Math.round(coord.score)}%`}</title>
        </circle>
      ))}
    </svg>
  );
}

function DimensionSparkline({ series }: { series: DimensionSeries }) {
  // Same bar as the score trend: a dimension "snapshot" is one answer, so two
  // of them is two answers.
  if (series.values.length < MIN_POINTS_FOR_TREND) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-4 text-xs text-gray-500">
        {series.label}: not enough data yet
      </div>
    );
  }

  const width = 280;
  const height = 72;
  const padding = 8;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const stepX =
    series.values.length === 1 ? 0 : innerW / (series.values.length - 1);

  const coords = series.values.map((value, index) => {
    const x = padding + index * stepX;
    const y = padding + innerH - (value / 100) * innerH;
    return { x, y };
  });

  const path = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`)
    .join(" ");

  const latest = series.values[series.values.length - 1];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-800">{series.label}</span>
        <span className="text-gray-500">{Math.round(latest)}%</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
        <path
          d={path}
          fill="none"
          stroke={series.color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function AnalyticsPage() {
  const { sessions, status, error, refresh } =
    useInterviewHistory(STATS_WINDOW);
  const model = useMemo(() => buildModel(sessions), [sessions]);
  const isLoading = status === "loading" && sessions.length === 0;

  const header = (
    <PageHeader
      eyebrow="Insights"
      title="Analytics"
      description="Real progress drawn from your interview history."
      icon={<BarChart3 className="h-6 w-6" />}
      iconColor="orange"
      actions={
        <Button asChild>
          <Link href="/simulate/setup">Start a session</Link>
        </Button>
      }
    />
  );

  // Every tile, trend and breakdown on this page is derived from `sessions`.
  // With none loaded they all render 0 / "—", which reads as "you have no
  // progress" rather than "we could not fetch it" — so bail out entirely.
  if (status === "error") {
    return (
      <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
        {header}
        <ErrorStateCard
          title="Couldn't load your analytics"
          description={error}
          onRetry={() => void refresh()}
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
      {header}

      {isLoading ? (
        <div className="grid md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <div
          className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", CONTENT_ENTER)}
        >
          <Card className="shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">Sessions</p>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${TILE_COLORS.blue}`}
                >
                  <Target className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{model.total}</p>
              <p className="mt-1 text-xs text-gray-500">
                {model.completed} scored
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">Avg score</p>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${TILE_COLORS.purple}`}
                >
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {formatAverageScore(model.averageScore)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Best:{" "}
                {model.bestScore === null
                  ? "—"
                  : `${Math.round(model.bestScore)}%`}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">
                  Practice time
                </p>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${TILE_COLORS.teal}`}
                >
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {formatPracticeMinutes(model.totalMinutes)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Across {model.daysActive} day
                {model.daysActive === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">Mode mix</p>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${TILE_COLORS.orange}`}
                >
                  <Mic className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {model.voiceCount}
                <span className="ml-1 text-base font-normal text-gray-500">
                  voice
                </span>
              </p>
              <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {model.textCount} text
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Score trend</CardTitle>
          <CardDescription>
            Up to your last 15 scored sessions, oldest on the left.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScoreSparkline points={model.trend} />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Skill dimensions</CardTitle>
          <CardDescription>
            Clarity, specificity, confidence, and STAR scores across your last
            scored answers (0–100).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {model.dimensionSeries.every(
            (series) => series.values.length < MIN_POINTS_FOR_TREND,
          ) ? (
            <p className="text-sm text-gray-500">
              Complete a few more scored answers in text mode to see
              per-dimension trends.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {model.dimensionSeries.map((series) => (
                <DimensionSparkline key={series.key} series={series} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Scenarios</CardTitle>
          <CardDescription>
            Where you spend the most practice and how you score in each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {model.scenarioBuckets.length === 0 ? (
            <p className="text-sm text-gray-500">
              Complete a session to see scenario breakdown.
            </p>
          ) : (
            <div className="space-y-4">
              {model.scenarioBuckets.map((bucket) => {
                const widthPct = Math.min(
                  100,
                  Math.max(8, (bucket.count / model.total) * 100),
                );
                return (
                  <div key={bucket.title} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700 truncate">
                        {bucket.title}
                      </span>
                      <span className="text-gray-500 shrink-0 ml-3">
                        {bucket.count} session
                        {bucket.count === 1 ? "" : "s"}
                        {/* An "average" of one session is that session's
                            score wearing a word it has not earned. */}
                        {bucket.averageScore !== null && bucket.count > 1
                          ? ` · avg ${Math.round(bucket.averageScore)}%`
                          : bucket.averageScore !== null
                            ? ` · ${Math.round(bucket.averageScore)}%`
                            : ""}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-linear-to-r from-blue-500 to-indigo-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
