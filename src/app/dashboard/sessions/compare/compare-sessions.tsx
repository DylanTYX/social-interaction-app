"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, GitCompareArrows, MessageSquare, Mic } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import {
  buildRadarAxes,
  DimensionRadar,
} from "@/components/report/dimension-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { readJson } from "@/lib/api/fetch-json";
import { getCurrentRound } from "@/lib/interview-rounds";
import { starDetail, technicalDetail } from "@/lib/report-insights";
import type { AnalysisResult } from "@/lib/response-analyzer";
import { isTechnicalRound } from "@/lib/round-types";
import { readLaunchMeta, type SessionLaunchMeta } from "@/lib/session-launch-meta";
import { displayTitle } from "@/lib/session-organisation";
import { cn } from "@/lib/utils";

/**
 * Two sessions side by side: what changed between attempts.
 *
 * Built from the same `/report` payload the report page uses, so every number
 * here is the one that report shows. Deltas read second minus first, and the
 * picker on the sessions list passes the sessions in the order they were ticked.
 */

interface ReportPayload {
  session: {
    id: string;
    title?: string | null;
    scenarioTitle: string | null;
    scenarioValue: string;
    personaName: string;
    practiceMode: "text" | "voice";
    averageScore: number | null;
    durationMinutes: number | null;
    metrics: Record<string, unknown> | null;
    launchMeta: SessionLaunchMeta | null;
    startedAt: string;
  };
  turnAnalyses: Array<{ analysis: Record<string, unknown> | null }>;
}

function pick(metrics: Record<string, unknown> | null, key: string): number | null {
  const value = metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function summarise(payload: ReportPayload) {
  const { session } = payload;
  const loop = readLaunchMeta(session as Parameters<typeof readLaunchMeta>[0])?.interviewLoop;
  const technical = isTechnicalRound(loop ? getCurrentRound(loop).type : undefined);
  const analyses = payload.turnAnalyses.flatMap((entry) => (entry.analysis ? [entry.analysis] : []));
  const confidence = pick(session.metrics, "averageConfidenceScore");
  const star = pick(session.metrics, "averageSTARScore");
  return {
    session,
    technical,
    analyses,
    overall: pick(session.metrics, "averageOverallScore") ?? session.averageScore,
    communication: confidence === null ? null : confidence * 10,
    rubric: star === null ? null : star * 10,
    duration: session.durationMinutes,
    answers: payload.turnAnalyses.length,
  };
}

type Summary = ReturnType<typeof summarise>;

function Delta({ from, to, unit, higherIsBetter = true }: { from: number | null; to: number | null; unit: string; higherIsBetter?: boolean }) {
  if (from === null || to === null) return <span className="text-slate-400">—</span>;
  const diff = Math.round(to - from);
  if (diff === 0) return <span className="text-slate-500">no change</span>;
  const good = higherIsBetter ? diff > 0 : diff < 0;
  return (
    <span className={cn("font-semibold tabular-nums", good ? "text-success-emphasis" : "text-destructive")}>
      {diff > 0 ? "+" : ""}
      {diff}
      {unit}
    </span>
  );
}

const fmt = (value: number | null, unit: string) =>
  value === null ? "—" : `${Math.round(value)}${unit}`;

export function CompareSessions() {
  const params = useSearchParams();
  const a = params.get("a");
  const b = params.get("b");
  const [pair, setPair] = useState<[Summary, Summary] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!a || !b) return;
    let cancelled = false;
    queueMicrotask(async () => {
      try {
        const [first, second] = await Promise.all(
          [a, b].map(async (id) =>
            readJson<ReportPayload>(
              await fetch(`/api/sessions/${encodeURIComponent(id)}/report`, { cache: "no-store" }),
            ),
          ),
        );
        if (!cancelled) setPair([summarise(first), summarise(second)]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load those sessions.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [a, b]);

  const back = (
    <Button asChild variant="outline" className="gap-1.5">
      <Link href="/dashboard/sessions">
        <ArrowLeft className="h-4 w-4" /> Back to sessions
      </Link>
    </Button>
  );

  if (!a || !b) {
    return (
      <div className="space-y-6">
        <PageHeader title="Compare two sessions" description="Tick two sessions on your sessions list, then choose Compare." actions={back} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Compare two sessions" actions={back} />
        <Card className="border-destructive-border bg-destructive-subtle">
          <CardContent className="py-6 text-sm text-destructive-emphasis">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="space-y-6">
        <PageHeader title="Compare two sessions" actions={back} />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const [first, second] = pair;
  const rubricLabel = first.technical && second.technical ? "Technical rubric" : "STAR average";
  const rows: Array<{ label: string; from: number | null; to: number | null; unit: string; higherIsBetter?: boolean }> = [
    { label: "Overall score", from: first.overall, to: second.overall, unit: "%" },
    { label: "Communication", from: first.communication, to: second.communication, unit: "%" },
    { label: rubricLabel, from: first.rubric, to: second.rubric, unit: "%" },
    { label: "Scored answers", from: first.answers, to: second.answers, unit: "" },
    { label: "Duration", from: first.duration, to: second.duration, unit: " min", higherIsBetter: false },
  ];

  const column = (entry: Summary, label: string) => {
    const ModeIcon = entry.session.practiceMode === "voice" ? Mic : MessageSquare;
    const axes = buildRadarAxes(entry.analyses as Partial<AnalysisResult>[], entry.technical);
    return (
      <Card className="border-slate-200/80 bg-white">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <CardTitle className="text-lg [overflow-wrap:anywhere]">{displayTitle(entry.session)}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <ModeIcon className="h-3 w-3" />
              {entry.session.practiceMode === "voice" ? "Voice" : "Text"}
            </Badge>
            <span>{entry.session.personaName}</span>
            <span>·</span>
            <span>{new Date(entry.session.startedAt).toLocaleDateString()}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-4xl font-bold tabular-nums text-slate-900">{fmt(entry.overall, "%")}</p>
          <p className="text-sm text-slate-600">{entry.technical ? technicalDetail(entry.analyses) : starDetail(entry.analyses)}</p>
          {axes && <DimensionRadar axes={axes} />}
          <Link href={`/simulate/report/${entry.session.id}`} className="text-sm font-medium text-primary hover:underline">
            Open full report →
          </Link>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sessions"
        icon={<GitCompareArrows className="h-5 w-5" />}
        title="Compare two sessions"
        description="What changed between two attempts, measured the same way each report measures it."
        actions={back}
      />

      <Card className="border-slate-200/80 bg-white">
        <CardHeader>
          <CardTitle className="text-base">At a glance</CardTitle>
          {first.technical !== second.technical && (
            <CardDescription>
              These rounds were scored on different rubrics, so the rubric row compares different things.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Measure</th>
                <th className="py-2 pr-4 font-medium">First</th>
                <th className="py-2 pr-4 font-medium">Second</th>
                <th className="py-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <td className="py-2.5 pr-4 text-slate-700">{row.label}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{fmt(row.from, row.unit)}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{fmt(row.to, row.unit)}</td>
                  <td className="py-2.5">
                    <Delta from={row.from} to={row.to} unit={row.unit} higherIsBetter={row.higherIsBetter} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {column(first, "First")}
        {column(second, "Second")}
      </div>
    </div>
  );
}
