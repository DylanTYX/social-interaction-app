"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, GaugeCircle, Lightbulb, Sparkles } from "lucide-react";

import { AnalyticsDashboard } from "@/components/chat/analytics-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadInterviewReportSnapshot } from "@/lib/interview-report";

function EmptyReportState() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-soft-md dark:border-slate-800 dark:bg-slate-950/70">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        No interview report available yet
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Start a chat interview first. Your detailed report will appear here
        automatically.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link href="/simulate/setup">
          <Button>Start interview</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

export default function InterviewReportPage() {
  const snapshot = useMemo(() => loadInterviewReportSnapshot(), []);

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-sky-50/40 px-6 py-8 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/simulate/setup">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Post-Interview Report</h1>
        </div>
        <EmptyReportState />
      </div>
    );
  }

  const latestAnalysis = snapshot.analyses[snapshot.analyses.length - 1];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-sky-50/40 px-6 py-8 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/simulate/setup">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Detailed evaluation
              </p>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                Post-Interview Report
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{snapshot.scenarioTitle}</Badge>
            <Badge variant="outline">{snapshot.personaName}</Badge>
            <Badge variant="secondary">
              {snapshot.sessionState.turnCount} turns
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Overall score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {snapshot.metrics
                  ? `${Math.round(snapshot.metrics.averageOverallScore)}%`
                  : "--"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Communication
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {snapshot.metrics
                  ? `${Math.round(snapshot.metrics.averageConfidenceScore * 10)}%`
                  : "--"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Technical depth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {snapshot.metrics
                  ? `${Math.round(snapshot.metrics.averageSTARScore * 10)}%`
                  : "--"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Relevance trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold capitalize text-slate-900 dark:text-slate-100">
                {snapshot.metrics?.improvementTrend ?? "--"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <AnalyticsDashboard
            analyses={snapshot.analyses}
            strategyHistory={snapshot.strategyHistory}
            metrics={snapshot.metrics}
          />

          <div className="space-y-4">
            <Card className="border-slate-200/80 bg-white/90 shadow-soft dark:border-slate-800 dark:bg-slate-950/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {latestAnalysis?.strengths?.length ? (
                  latestAnalysis.strengths.map((item) => (
                    <p key={item}>• {item}</p>
                  ))
                ) : (
                  <p>No strengths captured yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 shadow-soft dark:border-slate-800 dark:bg-slate-950/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <GaugeCircle className="h-4 w-4" />
                  Weaknesses & Gaps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {latestAnalysis?.gaps?.length ? (
                  latestAnalysis.gaps.map((item) => <p key={item}>• {item}</p>)
                ) : (
                  <p>No weaknesses captured yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 shadow-soft dark:border-slate-800 dark:bg-slate-950/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Lightbulb className="h-4 w-4" />
                  Improvement Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {latestAnalysis?.followupTopics?.length ? (
                  latestAnalysis.followupTopics.map((item) => (
                    <p key={item}>• Practice around: {item}</p>
                  ))
                ) : (
                  <p>
                    Complete more turns to generate targeted recommendations.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
