import { Brain, Gauge, Layers3, Radar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { InterviewSessionState } from "@/lib/interviewStateMachine";
import type { InterviewMetrics } from "@/lib/metricsTracker";
import type { InterviewStrategy } from "@/lib/responseAnalyzer";

type InterviewStatePanelProps = {
  state: InterviewSessionState;
  stageLabel: string;
  stageGuidance: string;
  lastStrategy: InterviewStrategy | null;
  decisionReason: string | null;
  decisionConfidence: number | null;
  metrics: InterviewMetrics | null;
};

const STRATEGY_LABELS: Record<InterviewStrategy, string> = {
  CLARIFY_SITUATION: "Behavioral probing",
  PROBE_ACTION: "Technical depth assessment",
  CHALLENGE_OWNERSHIP: "Ownership challenge",
  EXPLORE_RESULT: "Outcome verification",
  ACKNOWLEDGE_STRENGTH: "Escalating difficulty",
  DRILL_SPECIFICITY: "STAR-format evaluation",
  ASSESS_THINKING: "Communication analysis",
};

function normalizeConfidence(score: number | null): number {
  if (score === null) {
    return 0;
  }

  return Math.max(0, Math.min(100, score));
}

export function InterviewStatePanel({
  state,
  stageLabel,
  stageGuidance,
  lastStrategy,
  decisionReason,
  decisionConfidence,
  metrics,
}: InterviewStatePanelProps) {
  const confidence = normalizeConfidence(
    decisionConfidence ?? (metrics ? metrics.averageOverallScore : null),
  );
  const communication = metrics
    ? Math.max(0, Math.min(100, metrics.averageConfidenceScore * 10))
    : 0;

  return (
    <Card className="border border-slate-200/80 bg-white/80 shadow-soft backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
            Interview State Engine
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {stageLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1 border-slate-300/80 bg-white/70 dark:border-slate-700"
          >
            <Layers3 className="h-3.5 w-3.5" />
            Stage {state.currentStage}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 border-slate-300/80 bg-white/70 dark:border-slate-700"
          >
            <Brain className="h-3.5 w-3.5" />
            {lastStrategy
              ? STRATEGY_LABELS[lastStrategy]
              : "Strategy warming up"}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 border-slate-300/80 bg-white/70 dark:border-slate-700"
          >
            <Radar className="h-3.5 w-3.5" />
            {state.followupCount} adaptive follow-ups
          </Badge>
        </div>

        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
          {stageGuidance}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5" />
                Decision confidence
              </span>
              <span>{Math.round(confidence)}%</span>
            </div>
            <Progress
              value={confidence}
              className="h-1.5"
              aria-label="Decision confidence"
            />
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Communication signal</span>
              <span>{Math.round(communication)}%</span>
            </div>
            <Progress
              value={communication}
              className="h-1.5"
              aria-label="Communication signal"
            />
          </div>
        </div>

        {decisionReason && (
          <div className="rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            {decisionReason}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
