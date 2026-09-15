"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import {
  PageContainer,
  PageHeader,
  PANEL_LABEL,
} from "@/components/dashboard/page-header";
import { StatTile } from "@/components/dashboard/stat-tile";
import {
  useInterviewHistory,
  type InterviewSessionSummary,
} from "@/hooks/use-interview-history";
import { useJobDescriptions } from "@/hooks/use-job-descriptions";
import { useRubricBreakdown } from "@/hooks/use-rubric-breakdown";
import { aggregateCoverage } from "@/lib/competencies";
import {
  describeDifficulty,
  type DifficultyBand,
} from "@/lib/interview-difficulty";
import {
  ROUND_TYPE_LABELS,
  ROUND_TYPES,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
import { CONTENT_ENTER } from "@/lib/motion";
import {
  compareRecent,
  mean,
  MIN_ANSWERS_TO_COMPARE,
  MIN_ANSWERS_TO_NAME_WEAKEST,
  MIN_POINTS_FOR_TREND,
  sessionRoundType,
  summariseDelivery,
  type DeliveryFigures,
  type DeliverySummary,
  type RoundBreakdown,
} from "@/lib/progress-insights";
import { LONG_PAUSE_SECONDS } from "@/lib/speech-metrics";
import { getSuggestedNextSession } from "@/lib/recommendations";
import { DimensionRadar } from "@/components/report/dimension-radar";
import { parseDeliverySnapshots } from "@/lib/session-launch-meta";
import { isTechnicalRound } from "@/lib/round-types";
import { displayTitle } from "@/lib/session-organisation";
import {
  computeSessionStats,
  formatAverageScore,
  formatPracticeMinutes,
  isScoredSession,
  STATS_WINDOW,
} from "@/lib/session-stats";
import { cn } from "@/lib/utils";

/**
 * Progress, told honestly.
 *
 * What the page answers, in order: how much you have practised; for each round
 * type, whether you are improving and which part of the rubric is weakest;
 * and what to practise next. Then it says what it does not measure.
 *
 * The previous version drew one score line through every round type and every
 * interviewer, and stated a direction from it. The project's own evaluation
 * says why that misleads: each round type has its own rubric, and a supportive
 * interviewer's 78 is not a demanding one's. So scores are compared only
 * within a round type, and each point shows how demanding its interviewer was.
 * The rules live in `progress-insights.ts`, with tests.
 */

/** Scored sessions of one round type plotted on its chart. */
const MAX_TREND_POINTS = 15;

interface TrendPoint {
  id: string;
  score: number;
  title: string;
  createdAt: string;
  strictness?: number;
  warmth?: number;
  band: DifficultyBand;
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

function formatShortDate(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "" : SHORT_DATE.format(time);
}

function roundLabel(type: InterviewRoundType): string {
  return ROUND_TYPE_LABELS[type];
}

/** A dashed inset for a chart or list that does not have enough data yet. */
function NotEnoughData({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-balance text-slate-500">
      {children}
    </div>
  );
}

/**
 * How a point is drawn for each interviewer difficulty. Shape rather than
 * colour, so the chart stays blue like every chart and still reads in
 * greyscale: hollow for supportive, filled for balanced, a diamond for
 * demanding.
 */
function DifficultyGlyph({
  band,
  cx,
  cy,
  r,
}: {
  band: DifficultyBand;
  cx: number;
  cy: number;
  r: number;
}) {
  if (band === "demanding") {
    const d = r * 1.35;
    return (
      <path
        d={`M ${cx} ${cy - d} L ${cx + d} ${cy} L ${cx} ${cy + d} L ${cx - d} ${cy} Z`}
        fill="currentColor"
        className="stroke-white"
        strokeWidth={1.5}
      />
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={band === "gentle" ? "white" : "currentColor"}
      stroke={band === "gentle" ? "currentColor" : "white"}
      strokeWidth={band === "gentle" ? 2 : 1.5}
    />
  );
}

const BAND_LEGEND: Record<DifficultyBand, string> = {
  gentle: "Supportive interviewer",
  balanced: "Balanced interviewer",
  demanding: "Demanding interviewer",
};

function LegendGlyph({ band }: { band: DifficultyBand }) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 text-primary" aria-hidden>
      <DifficultyGlyph band={band} cx={6} cy={6} r={4} />
    </svg>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const width = 760;
  const height = 230;
  const pad = { top: 22, right: 64, bottom: 30, left: 34 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const y = (value: number) => pad.top + innerH - (value / 100) * innerH;
  const x = (index: number) =>
    pad.left +
    (points.length === 1 ? innerW / 2 : (index * innerW) / (points.length - 1));

  const coords = points.map((point, index) => ({
    ...point,
    cx: x(index),
    cy: y(point.score),
  }));
  const linePath = coords
    .map((c, index) => `${index === 0 ? "M" : "L"} ${c.cx} ${c.cy}`)
    .join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].cx} ${
    pad.top + innerH
  } L ${coords[0].cx} ${pad.top + innerH} Z`;

  const average = mean(points.map((point) => point.score));
  const first = coords[0];
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full text-primary"
      role="img"
      aria-label={`${points.length} scored sessions, from ${Math.round(
        first.score,
      )}% to ${Math.round(last.score)}%, averaging ${Math.round(average)}%.`}
    >
      {[0, 25, 50, 75, 100].map((value) => (
        <g key={value}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={y(value)}
            y2={y(value)}
            className="stroke-slate-100"
            strokeWidth={1}
          />
          <text
            x={pad.left - 8}
            y={y(value) + 4}
            textAnchor="end"
            fontSize="10"
            className="fill-slate-400"
          >
            {value}
          </text>
        </g>
      ))}
      <line
        x1={pad.left}
        x2={width - pad.right}
        y1={y(average)}
        y2={y(average)}
        className="stroke-slate-400"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text
        x={width - pad.right + 8}
        y={y(average) + 4}
        fontSize="10"
        className="fill-slate-500"
      >
        Avg {Math.round(average)}
      </text>
      <path d={areaPath} fill="currentColor" fillOpacity={0.08} />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((c, index) => (
        <g key={c.id}>
          <DifficultyGlyph
            band={c.band}
            cx={c.cx}
            cy={c.cy}
            r={index === coords.length - 1 ? 5 : 4}
          />
          <title>{`${c.title} · ${formatShortDate(c.createdAt)} · ${Math.round(c.score)}% · ${BAND_LEGEND[c.band]}`}</title>
        </g>
      ))}
      <text
        x={last.cx}
        y={last.cy - 12}
        textAnchor="end"
        fontSize="13"
        fontWeight="700"
        className="fill-navy"
      >
        {Math.round(last.score)}%
      </text>
      <text
        x={first.cx}
        y={height - 8}
        textAnchor="start"
        fontSize="10"
        className="fill-slate-400"
      >
        {formatShortDate(first.createdAt)}
      </text>
      <text
        x={last.cx}
        y={height - 8}
        textAnchor="end"
        fontSize="10"
        className="fill-slate-400"
      >
        {formatShortDate(last.createdAt)}
      </text>
    </svg>
  );
}

/** "Your last 5 behavioural sessions average 72%, up 6 points on the 5 before." */
function describeTrend(
  points: TrendPoint[],
  type: InterviewRoundType,
): { sentence: string; change: number | null } {
  const label = roundLabel(type);
  const comparison = compareRecent(points);
  if (!comparison) {
    return {
      sentence:
        points.length >= MIN_POINTS_FOR_TREND
          ? `Your last ${points.length} scored ${label} sessions, oldest on the left. After 8, this will say whether you are improving.`
          : `Each scored ${label} session adds a point to this chart.`,
      change: null,
    };
  }

  const { window, recentAverage, change, difficultyShift } = comparison;
  const direction =
    change === 0
      ? `level with the ${window} before`
      : `${change > 0 ? "up" : "down"} ${Math.abs(change)} point${
          Math.abs(change) === 1 ? "" : "s"
        } on the ${window} before`;
  const caveat =
    difficultyShift === "tougher"
      ? " Your recent interviewers were more demanding, which pulls scores down."
      : difficultyShift === "gentler"
        ? " Your recent interviewers were more supportive, which lifts scores."
        : "";

  return {
    sentence: `Your last ${window} ${label} sessions average ${recentAverage}%, ${direction}.${caveat}`,
    change,
  };
}

/** "+1.2", "−0.8" out of 10, or "No change". */
function formatTenthsChange(change: number): string {
  if (change === 0) return "No change";
  return change > 0
    ? `+${change.toFixed(1)}`
    : `−${Math.abs(change).toFixed(1)}`;
}

/**
 * The rubric for one round type: a radar for its shape and a list for its
 * numbers, side by side in one card so they share a height rather than two
 * cards stretching to match each other. With enough answers the radar carries
 * a dashed outline of your older answers, which is what makes it more than a
 * second drawing of the list: growth shows as the gap between the shapes.
 */
function RubricCard({
  type,
  breakdown,
  status,
  onRetry,
}: {
  type: InterviewRoundType;
  breakdown: RoundBreakdown | undefined;
  status: "loading" | "ready" | "error";
  onRetry: () => void;
}) {
  const technical = isTechnicalRound(type);
  const label = roundLabel(type);
  const weakest = breakdown?.weakest ?? null;
  const criteria = breakdown?.criteria ?? [];
  const comparing = criteria.some((criterion) => criterion.change !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {technical ? "Technical rubric" : "STAR structure"}
        </CardTitle>
        <CardDescription>
          {status !== "ready"
            ? `How your ${label} answers score on each part of the rubric.`
            : weakest
              ? `${weakest.label} is your weakest part: ${weakest.advice}.`
              : breakdown && breakdown.answers > 0
                ? `Across ${breakdown.answers} ${label} answer${breakdown.answers === 1 ? "" : "s"}. Your weakest part is named once you have ${MIN_ANSWERS_TO_NAME_WEAKEST} answers and one part is clearly lowest.`
                : `No scored ${label} answers yet.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "loading" ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : status === "error" ? (
          <ErrorStateCard
            title="Couldn't load your answer scores"
            onRetry={onRetry}
          />
        ) : criteria.length === 0 ? (
          <NotEnoughData>
            Answer a few {label} questions to see which part of the rubric needs
            work.
          </NotEnoughData>
        ) : (
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
            <div>
              <DimensionRadar
                axes={criteria.map((criterion) => ({
                  label: criterion.label,
                  value: criterion.average,
                }))}
                earlier={
                  comparing
                    ? criteria.map((criterion) => criterion.earlier)
                    : null
                }
                className="mx-auto h-auto w-full max-w-96"
              />
              {comparing && (
                <ul className="mt-1 flex justify-center gap-x-5 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <span
                      className="h-0.5 w-4 rounded-full bg-primary"
                      aria-hidden
                    />
                    All answers
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span
                      className="h-0 w-4 border-t-[1.5px] border-dashed border-slate-400"
                      aria-hidden
                    />
                    Older half
                  </li>
                </ul>
              )}
            </div>

            <div>
              <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_2.5rem_4rem] items-center gap-x-4 pb-2">
                <span className={PANEL_LABEL}>Part</span>
                <span className={PANEL_LABEL}>Average /10</span>
                <span />
                <span className={cn(PANEL_LABEL, "text-right")}>Change</span>
              </div>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {criteria.map((criterion) => {
                  const isWeakest = weakest?.key === criterion.key;
                  return (
                    <li
                      key={criterion.key}
                      className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_2.5rem_4rem] items-center gap-x-4 py-2.5"
                    >
                      <span className="truncate text-sm font-medium text-slate-900">
                        {criterion.label}
                      </span>
                      <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            // Amber for the one to work on; blue for the rest.
                            isWeakest ? "bg-warning" : "bg-primary",
                          )}
                          style={{ width: `${criterion.average * 10}%` }}
                        />
                      </span>
                      <span
                        className={cn(
                          "text-right font-display text-base font-bold tabular-nums",
                          isWeakest ? "text-warning-emphasis" : "text-navy",
                        )}
                      >
                        {criterion.average.toFixed(1)}
                      </span>
                      <span
                        className={cn(
                          "text-right text-xs tabular-nums",
                          criterion.change === null || criterion.change === 0
                            ? "text-slate-400"
                            : criterion.change > 0
                              ? "text-success-emphasis"
                              : "text-warning-emphasis",
                        )}
                      >
                        {criterion.change === null
                          ? "—"
                          : formatTenthsChange(criterion.change)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                {comparing
                  ? `Your last ${breakdown?.answers} ${label} answers. Change compares the newer half with the older half.`
                  : `Your last ${breakdown?.answers} ${label} answer${breakdown?.answers === 1 ? "" : "s"}. Change appears once you have ${MIN_ANSWERS_TO_COMPARE}.`}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * What answers of this round type most often lacked.
 *
 * Each check is a judgement the analyzer made while scoring the answer, from
 * its transcript, and stored with the score. The page used to count fixed
 * phrasings instead, which only fired when an answer happened to use those
 * exact words.
 */
function MissingCard({
  type,
  breakdown,
  status,
}: {
  type: InterviewRoundType;
  breakdown: RoundBreakdown | undefined;
  status: "loading" | "ready" | "error";
}) {
  const label = roundLabel(type);
  const missing = breakdown?.missing ?? [];
  const top = missing.find((item) => item.answers > 0);
  const judged = Math.max(0, ...missing.map((item) => item.checked));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">What your answers lacked</CardTitle>
        <CardDescription>
          {status !== "ready" || judged === 0
            ? `What the AI found missing when it scored your ${label} answers.`
            : top && judged >= MIN_ANSWERS_TO_NAME_WEAKEST
              ? `Most often: ${top.label.toLowerCase()}, in ${top.answers} of ${top.checked} answers. Try to ${top.advice}.`
              : top
                ? `Across ${judged} ${label} answer${judged === 1 ? "" : "s"} so far. A pattern is named once you have ${MIN_ANSWERS_TO_NAME_WEAKEST}.`
                : `Nothing was consistently missing across ${judged} ${label} answer${judged === 1 ? "" : "s"}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "loading" ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : status === "error" ? null : missing.length === 0 ? (
          <NotEnoughData>
            Answer a few {label} questions to see what your answers tend to
            leave out.
          </NotEnoughData>
        ) : (
          <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ul className="grid content-start gap-x-8 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {missing.map((item) => {
                const share = item.checked ? item.answers / item.checked : 0;
                return (
                  <li key={item.id} title={`Try to ${item.advice}.`}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span
                        className={cn(
                          "truncate",
                          item.answers > 0
                            ? "font-medium text-slate-900"
                            : "text-slate-500",
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                        {item.answers} of {item.checked}
                      </span>
                    </div>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${share * 100}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>

            {breakdown && breakdown.notes.length > 0 && (
              <section className="lg:border-l lg:border-slate-100 lg:pl-10">
                <h3 className={PANEL_LABEL}>From your latest answers</h3>
                <ul className="mt-3 space-y-2.5">
                  {breakdown.notes.map((note) => (
                    <li
                      key={note}
                      className="border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-600"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
        {status === "ready" && missing.length > 0 && (
          <p className="mt-4 text-xs text-slate-500">
            Judged by the AI from each answer as it was scored, so treat the
            counts as a guide.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type Tone = "good" | "warn" | null;

const PACE_READING: Record<
  NonNullable<DeliveryFigures["paceLabel"]>,
  { text: string; tone: Tone }
> = {
  slow: { text: "Slower than conversation", tone: "warn" },
  measured: { text: "Measured", tone: "good" },
  conversational: { text: "Conversational", tone: "good" },
  fast: { text: "Faster than conversation", tone: "warn" },
};

const FILLER_READING: Record<
  NonNullable<DeliveryFigures["fillerLabel"]>,
  { text: string; tone: Tone }
> = {
  clean: { text: "Rare", tone: "good" },
  occasional: { text: "Occasional", tone: null },
  frequent: { text: "Frequent", tone: "warn" },
};

function ToneMark({ tone }: { tone: Tone }) {
  if (!tone) return null;
  return (
    <>
      <span
        className={cn(
          "mt-1 h-2 w-2 shrink-0 rounded-[2px]",
          tone === "good" ? "bg-success" : "bg-warning",
        )}
        aria-hidden
      />
      <span className="sr-only">
        {tone === "good" ? "Good: " : "Needs attention: "}
      </span>
    </>
  );
}

/**
 * How your spoken answers sound, across voice interviews.
 *
 * Measured in the browser from the recognizer's timing as you answered, and
 * saved with each scored spoken answer. The same three measures and bands as
 * the live interview and the drills readout.
 */
function VoiceDeliveryCard({ summary }: { summary: DeliverySummary | null }) {
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Voice delivery</CardTitle>
          <CardDescription>
            Pace, filler words and long pauses across your voice interviews.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotEnoughData>
            Answer questions in a voice interview to start tracking how you
            sound.
          </NotEnoughData>
        </CardContent>
      </Card>
    );
  }

  const { recent, earlier } = summary;
  const pace = recent.paceLabel ? PACE_READING[recent.paceLabel] : null;
  const fillers = recent.fillerLabel
    ? FILLER_READING[recent.fillerLabel]
    : null;

  const fillerChange =
    earlier?.fillersPer100 != null && recent.fillersPer100 != null
      ? Math.round((recent.fillersPer100 - earlier.fillersPer100) * 10) / 10
      : null;
  const sentence =
    fillerChange !== null && earlier
      ? fillerChange === 0
        ? `Filler words are level with your ${earlier.answers} answers before.`
        : `Filler words are ${fillerChange < 0 ? "down" : "up"} from ${earlier.fillersPer100} to ${recent.fillersPer100} per 100 words since your ${earlier.answers} answers before.`
      : `Your last ${recent.answers} spoken answer${recent.answers === 1 ? "" : "s"}. Change appears once you have ${MIN_ANSWERS_TO_COMPARE}.`;

  const cells: Array<{
    label: string;
    value: string;
    unit?: string;
    reading: string;
    tone: Tone;
    before: string | null;
  }> = [
    {
      label: "Pace",
      value: recent.wpm === null ? "—" : String(recent.wpm),
      unit: recent.wpm === null ? undefined : "words/min",
      reading: pace?.text ?? "Answers too short to time",
      tone: pace?.tone ?? null,
      before: earlier?.wpm != null ? `Before: ${earlier.wpm} words/min` : null,
    },
    {
      label: "Filler words",
      value: recent.fillersPer100 === null ? "—" : String(recent.fillersPer100),
      unit: recent.fillersPer100 === null ? undefined : "per 100 words",
      reading: fillers?.text ?? "No words recorded",
      tone: fillers?.tone ?? null,
      before:
        earlier?.fillersPer100 != null
          ? `Before: ${earlier.fillersPer100} per 100 words`
          : null,
    },
    {
      label: "Long pauses",
      value:
        recent.longPausesPerAnswer === null
          ? "—"
          : String(recent.longPausesPerAnswer),
      unit: recent.longPausesPerAnswer === null ? undefined : "per answer",
      reading: `Gaps of ${LONG_PAUSE_SECONDS} s or more`,
      tone: null,
      before:
        earlier?.longPausesPerAnswer != null
          ? `Before: ${earlier.longPausesPerAnswer} per answer`
          : null,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Voice delivery</CardTitle>
        <CardDescription>{sentence}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:grid-cols-3">
          {cells.map((cell) => (
            <div key={cell.label} className="bg-white p-4">
              <dt className="text-xs text-slate-500">{cell.label}</dt>
              <dd className="mt-2 font-display text-2xl leading-none font-bold tracking-tight text-navy tabular-nums">
                {cell.value}
                {cell.unit && (
                  <span className="ml-1 font-sans text-xs font-medium tracking-normal text-slate-500">
                    {cell.unit}
                  </span>
                )}
              </dd>
              <dd className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-slate-600">
                <ToneMark tone={cell.tone} />
                <span>{cell.reading}</span>
              </dd>
              {cell.before && (
                <dd className="mt-1 text-xs text-slate-400 tabular-nums">
                  {cell.before}
                </dd>
              )}
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Your last {recent.answers} spoken answer
          {recent.answers === 1 ? "" : "s"} in voice interviews, measured from
          the timing of your speech. Quick drills are not saved.
        </p>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { sessions, status, error, refresh } =
    useInterviewHistory(STATS_WINDOW);
  const rubric = useRubricBreakdown();
  const { items: jobDescriptions, status: jobDescriptionStatus } =
    useJobDescriptions();
  const [chosenRound, setChosenRound] = useState<InterviewRoundType | null>(
    null,
  );

  const stats = useMemo(() => computeSessionStats(sessions), [sessions]);
  const daysActive = useMemo(
    () =>
      new Set(
        sessions
          .map((entry) => Date.parse(entry.createdAt))
          .filter((time) => !Number.isNaN(time))
          .map((time) => new Date(time).toDateString()),
      ).size,
    [sessions],
  );

  // Scored sessions by round type, oldest first. The same rule as the
  // headline average decides what counts, so the two cannot disagree.
  const pointsByRound = useMemo(() => {
    const map = new Map<InterviewRoundType, TrendPoint[]>();
    const scored = sessions
      .filter(isScoredSession)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    for (const entry of scored) {
      const type = sessionRoundType(entry);
      const list = map.get(type) ?? [];
      list.push({
        id: entry.id,
        score: entry.averageScore,
        title: displayTitle(entry),
        createdAt: entry.createdAt,
        strictness: entry.personaConfig?.strictness,
        warmth: entry.personaConfig?.warmth,
        band: describeDifficulty(
          entry.personaConfig?.strictness,
          entry.personaConfig?.warmth,
        ).band,
      });
      map.set(type, list);
    }
    return map;
  }, [sessions]);

  // Every round type with anything to show, most practised first.
  const roundTypes = useMemo(() => {
    const answersFor = (type: InterviewRoundType) =>
      rubric.rounds.find((round) => round.roundType === type)?.answers ?? 0;
    return ROUND_TYPES.filter(
      (type) =>
        (pointsByRound.get(type)?.length ?? 0) > 0 || answersFor(type) > 0,
    ).sort(
      (a, b) =>
        (pointsByRound.get(b)?.length ?? 0) -
          (pointsByRound.get(a)?.length ?? 0) || answersFor(b) - answersFor(a),
    );
  }, [pointsByRound, rubric.rounds]);

  const activeRound =
    chosenRound && roundTypes.includes(chosenRound)
      ? chosenRound
      : (roundTypes[0] ?? null);

  const suggestion = useMemo(
    () =>
      getSuggestedNextSession(sessions, {
        hasJobDescriptions:
          jobDescriptionStatus === "ready"
            ? jobDescriptions.length > 0
            : undefined,
        hasVoiceSessions: sessions.some(
          (entry: InterviewSessionSummary) => entry.practiceMode === "voice",
        ),
      }),
    [sessions, jobDescriptions.length, jobDescriptionStatus],
  );

  const coverage = useMemo(
    () => aggregateCoverage(sessions.map((entry) => entry.competencyCoverage)),
    [sessions],
  );
  const notAskedYet = coverage.filter((entry) => entry.sessions === 0);

  const delivery = useMemo(
    () =>
      summariseDelivery(
        sessions
          .filter((entry) => entry.practiceMode === "voice")
          .flatMap((entry) =>
            parseDeliverySnapshots(
              (entry.metrics as Record<string, unknown> | null | undefined)
                ?.deliverySnapshots,
            ),
          ),
      ),
    [sessions],
  );

  const header = (
    <PageHeader
      title="Analytics"
      description="How you are improving in each kind of round, and what to practise next."
      actions={
        <Button asChild>
          <Link href="/simulate/setup">
            <Plus />
            New interview
          </Link>
        </Button>
      }
    />
  );

  // A failed load must not read as "you have made no progress".
  if (status === "error") {
    return (
      <PageContainer>
        {header}
        <ErrorStateCard
          title="Couldn't load your analytics"
          description={error}
          onRetry={() => void refresh()}
        />
      </PageContainer>
    );
  }

  if (status === "loading" && sessions.length === 0) {
    return (
      <PageContainer>
        {header}
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </PageContainer>
    );
  }

  if (sessions.length === 0) {
    return (
      <PageContainer>
        {header}
        <EmptyStateCard
          title="Your progress will show up here"
          description="Complete a few interviews. Each round type gets its own score trend, rubric breakdown and evidence gaps."
          primaryAction={{ label: "New interview", href: "/simulate/setup" }}
        />
      </PageContainer>
    );
  }

  const points = activeRound ? (pointsByRound.get(activeRound) ?? []) : [];
  const shownPoints = points.slice(-MAX_TREND_POINTS);
  const trend = activeRound ? describeTrend(points, activeRound) : null;
  const bandsShown = (["gentle", "balanced", "demanding"] as const).filter(
    (band) => shownPoints.some((point) => point.band === band),
  );
  const activeBreakdown = rubric.rounds.find(
    (round) => round.roundType === activeRound,
  );

  return (
    <PageContainer className={CONTENT_ENTER}>
      {header}

      {/* How much you have practised. Context, not a verdict: the average
          pools every round type, and its caption says so. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Average score"
          value={formatAverageScore(stats.averageScore)}
          caption="All round types together"
        />
        <StatTile
          label="Scored sessions"
          value={stats.completed}
          caption={`Of ${stats.total} session${stats.total === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Practice time"
          value={formatPracticeMinutes(stats.totalMinutes)}
          caption={`Across ${daysActive} day${daysActive === 1 ? "" : "s"}`}
        />
      </div>

      {activeRound && (
        <section className="space-y-4" aria-labelledby="progress-heading">
          <div>
            <h2
              id="progress-heading"
              className="font-display text-xl font-semibold tracking-tight text-slate-900"
            >
              Progress by round type
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Each round type has its own rubric, so each is tracked on its own.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200"
            role="group"
            aria-label="Round type"
          >
            {roundTypes.map((type) => {
              const current = type === activeRound;
              const count = pointsByRound.get(type)?.length ?? 0;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={current}
                  onClick={() => setChosenRound(type)}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted",
                    current
                      ? "border-primary text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-900",
                  )}
                >
                  {roundLabel(type)}
                  <span className="text-xs font-normal text-slate-400 tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Score over time</CardTitle>
              <CardDescription>{trend?.sentence}</CardDescription>
              {trend?.change !== null &&
                trend?.change !== undefined &&
                trend.change !== 0 && (
                  <CardAction>
                    {/* Up is good, down needs attention. Never red. */}
                    <Badge
                      variant={trend.change > 0 ? "success" : "warning"}
                      className="tabular-nums"
                    >
                      {trend.change > 0 ? "+" : "−"}
                      {Math.abs(trend.change)} points
                    </Badge>
                  </CardAction>
                )}
            </CardHeader>
            <CardContent>
              {shownPoints.length < MIN_POINTS_FOR_TREND ? (
                <NotEnoughData>
                  {shownPoints.length === 0
                    ? `No scored ${roundLabel(activeRound)} sessions yet. A session is scored once it is finished with at least three answers.`
                    : `You have ${shownPoints.length} scored ${roundLabel(activeRound)} session${shownPoints.length === 1 ? "" : "s"}. The chart appears once you have ${MIN_POINTS_FOR_TREND}.`}
                </NotEnoughData>
              ) : (
                <>
                  <TrendChart points={shownPoints} />
                  <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                    {bandsShown.map((band) => (
                      <li key={band} className="flex items-center gap-1.5">
                        <LegendGlyph band={band} />
                        {BAND_LEGEND[band]}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          <RubricCard
            type={activeRound}
            breakdown={activeBreakdown}
            status={rubric.status}
            onRetry={() => void rubric.refresh()}
          />
          <MissingCard
            type={activeRound}
            breakdown={activeBreakdown}
            status={rubric.status}
          />
        </section>
      )}

      {/* Not by round type: how you sound does not depend on the rubric. */}
      <VoiceDeliveryCard summary={delivery} />

      {/* The other half of the requirement: a suggestion for what to practise
          next. The one tinted card on the page, because it holds the one
          action the page leads to. */}
      <Card className="border-primary-border bg-primary-subtle">
        <CardHeader>
          <CardTitle className="text-lg">What to practise next</CardTitle>
          <CardDescription className="text-slate-600">
            {suggestion?.reason ??
              "Set up a round, pick an interviewer, and go."}
          </CardDescription>
          <CardAction>
            <Button asChild>
              <Link href={suggestion?.href ?? "/simulate/setup"}>
                {/* The verb matches what the link does: an unfinished
                    interview is resumed, not started again. */}
                {suggestion?.id === "resume"
                  ? "Resume interview"
                  : suggestion?.id === "weakest-scenario"
                    ? "Open last attempt"
                    : "Start interview"}
                <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="font-medium text-slate-900">
              {suggestion?.title ?? "Start a practice interview"}
            </p>
            {suggestion?.description && (
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                {suggestion.description}
              </p>
            )}
          </div>
          {notAskedYet.length > 0 && (
            <div className="border-t border-primary-border pt-4">
              <h3 className={PANEL_LABEL}>
                Not asked about yet · {notAskedYet.length} of {coverage.length}
              </h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {notAskedYet.map(({ competency }) => (
                  <li
                    key={competency.id}
                    title={competency.summary}
                    className="inline-flex h-6 items-center rounded-md border border-warning-border bg-warning-subtle px-2 text-xs font-medium text-warning-emphasis"
                  >
                    {competency.label}
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-xs text-slate-500">
                No interview so far has asked about these. Being asked about a
                competency says nothing about how well you answered it.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What the page does not measure, said rather than implied. */}
      <section
        className="border-t border-slate-200 pt-6"
        aria-labelledby="not-tracked-heading"
      >
        <h2 id="not-tracked-heading" className={PANEL_LABEL}>
          Not tracked here
        </h2>
        <ul className="mt-3 grid gap-x-8 gap-y-4 text-sm text-slate-600 md:grid-cols-3">
          {[
            {
              title: "Quick drills",
              body: "Drill answers are coached as you go but not saved, so they are not counted here.",
            },
            {
              title: "Comparisons across round types",
              body: "Behavioural and technical scores use different rubrics, so they are never compared.",
            },
            {
              title: "Interviewer difficulty",
              body: "Supportive interviewers ask easier questions. Scores are not adjusted for who asked.",
            },
          ].map((item) => (
            <li key={item.title}>
              <p className="font-medium text-slate-900">{item.title}</p>
              <p className="mt-1 text-pretty">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
