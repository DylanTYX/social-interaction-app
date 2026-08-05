"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ROUND_TYPE_LABELS,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
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
          setError(err instanceof Error ? err.message : "Something went wrong.");
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
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Could not load loop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600" role="alert">
              {error}
            </p>
            <Link href="/dashboard/sessions">
              <Button>Back to sessions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { rounds, totals } = report;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/dashboard/sessions">
          <Button variant="ghost" size="icon" aria-label="Back to sessions">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Interview loop report
          </h1>
          <p className="text-sm text-slate-500">
            {totals.roundsCompleted} of {totals.roundsTotal} rounds complete
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Average score" value={totals.averageScore ?? "—"} />
        <StatTile
          label="Change across loop"
          value={totals.delta === null ? "—" : formatDelta(totals.delta)}
          trend={totals.delta}
        />
        <StatTile label="Total turns" value={totals.totalTurns} />
        <StatTile
          label="Time practised"
          value={totals.totalMinutes ? `${totals.totalMinutes}m` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progression across rounds</CardTitle>
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

      <div className="space-y-3">
        {rounds.map((round) => (
          <Card key={round.sessionId}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    Round {round.roundIndex + 1}
                    {round.title ? ` · ${round.title}` : ""}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                    {round.roundType && (
                      <Badge variant="secondary">
                        {ROUND_TYPE_LABELS[round.roundType]}
                      </Badge>
                    )}
                    <Badge variant="outline">{round.practiceMode}</Badge>
                    {round.status !== "completed" && (
                      <Badge variant="outline">{round.status}</Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums text-slate-900">
                    {round.averageScore ?? "—"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {round.turnCount} turns
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(round.strengths.length > 0 || round.gaps.length > 0) && (
                <div className="grid gap-3 sm:grid-cols-2">
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
                className="inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                View full round report →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

function StatTile({
  label,
  value,
  trend,
}: {
  label: string;
  value: string | number;
  trend?: number | null;
}) {
  const Icon =
    trend === undefined || trend === null
      ? null
      : trend > 0
        ? TrendingUp
        : trend < 0
          ? TrendingDown
          : Minus;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums text-slate-900">
        {Icon && <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />}
        {value}
      </div>
    </div>
  );
}

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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li
            key={item}
            className={`text-sm ${
              tone === "positive" ? "text-emerald-700" : "text-slate-700"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
