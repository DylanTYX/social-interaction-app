"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import {
  PageContainer,
  PageHeader,
  PANEL_LABEL,
} from "@/components/dashboard/page-header";
import { StatTile } from "@/components/dashboard/stat-tile";
import {
  ROUND_TYPE_LABELS,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
import { ROUND_TYPE_SPECS } from "@/lib/round-types";
import { TILE_COLORS } from "@/lib/tile-colors";
import { RoundProgression } from "@/components/report/round-progression";

interface LoopRound {
  sessionId: string;
  roundIndex: number;
  title: string | null;
  roundType: InterviewRoundType | null;
  practiceMode: "text" | "voice";
  status: string;
  averageScore: number | null;
  turnCount: number;
  durationMinutes: number | null;
  createdAt: string;
  turnScores: number[];
  strengths: string[];
  gaps: string[];
}

interface LoopReport {
  loopId: string;
  rounds: LoopRound[];
  totals: {
    roundsCompleted: number;
    roundsTotal: number;
    averageScore: number | null;
    delta: number | null;
    totalTurns: number;
    totalMinutes: number;
  };
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

function formatScore(score: number | null): string {
  return score === null ? "—" : `${Math.round(score)}%`;
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/**
 * Every round of a loop on one page: the totals, the shape of the scores, and
 * one card per round. Built on the same frame, tiles and tags as the session
 * report, so the two reports read as one product.
 */
export default function LoopReportPage({
  params,
}: {
  params: Promise<{ loopId: string }>;
}) {
  const { loopId } = use(params);
  const [report, setReport] = useState<LoopReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/loops/${encodeURIComponent(loopId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "This interview loop could not be found."
              : "Failed to load the loop report.",
          );
        }
        const payload = (await response.json()) as LoopReport;
        if (!cancelled) setReport(payload);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Something went wrong.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loopId]);

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Interview loop report" />
        <Skeleton className="h-40 rounded-xl" />
      </PageContainer>
    );
  }

  if (error || !report || report.rounds.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Interview loop report" />
        <ErrorStateCard
          title="Couldn't load this loop"
          description={error ?? "This loop has no rounds to report on yet."}
        />
        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/dashboard/sessions">Go to sessions</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  const { rounds, totals } = report;
  const DeltaIcon =
    totals.delta === null
      ? null
      : totals.delta > 0
        ? TrendingUp
        : totals.delta < 0
          ? TrendingDown
          : Minus;

  return (
    <PageContainer className={CONTENT_ENTER}>
      <PageHeader
        title="Interview loop report"
        description={`${totals.roundsCompleted} of ${totals.roundsTotal} rounds complete`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Average score"
          value={formatScore(totals.averageScore)}
        />
        <StatTile
          label="Change across loop"
          value={
            <span className="inline-flex items-center gap-1.5">
              {DeltaIcon && (
                <DeltaIcon className="h-5 w-5 text-slate-400" aria-hidden />
              )}
              {totals.delta === null ? "—" : formatDelta(totals.delta)}
            </span>
          }
        />
        <StatTile label="Answers" value={totals.totalTurns} />
        <StatTile
          label="Interview time"
          value={totals.totalMinutes ? `${totals.totalMinutes} min` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Progression across rounds</CardTitle>
          <CardDescription>
            Each round is scored independently against its own rubric, so
            compare the shape of the trend rather than the absolute values.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoundProgression
            points={rounds.map((round) => ({
              label: round.title ?? `Round ${round.roundIndex + 1}`,
              score: round.averageScore,
            }))}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {rounds.map((round) => (
          <Card key={round.sessionId}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-lg">
                    Round {round.roundIndex + 1}
                    {round.title ? ` · ${round.title}` : ""}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2 pt-1.5">
                    {round.roundType && (
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold",
                          TILE_COLORS[ROUND_TYPE_SPECS[round.roundType].accent],
                        )}
                      >
                        {ROUND_TYPE_LABELS[round.roundType]}
                      </span>
                    )}
                    <Badge variant="outline">
                      {round.practiceMode === "voice" ? "Voice" : "Text"}
                    </Badge>
                    {round.status !== "completed" && (
                      <Badge
                        variant={
                          round.status === "in_progress" ? "warning" : "outline"
                        }
                      >
                        {STATUS_LABEL[round.status] ?? round.status}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl leading-none font-bold tracking-tight text-navy tabular-nums">
                    {formatScore(round.averageScore)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {round.turnCount} answer{round.turnCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(round.strengths.length > 0 || round.gaps.length > 0) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ThemeList
                    title="Recurring strengths"
                    items={round.strengths}
                    tone="positive"
                  />
                  <ThemeList
                    title="Recurring gaps"
                    items={round.gaps}
                    tone="constructive"
                  />
                </div>
              )}
              <Link
                href={`/simulate/report/${round.sessionId}`}
                className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                View full round report →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}

/** Green for what went well, amber for what needs attention. */
function ThemeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "constructive";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className={PANEL_LABEL}>{title}</h3>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "text-sm",
              tone === "positive"
                ? "text-success-emphasis"
                : "text-warning-emphasis",
            )}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
