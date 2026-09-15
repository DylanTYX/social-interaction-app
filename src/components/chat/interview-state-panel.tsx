import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { InterviewSessionState } from "@/lib/interview-session-state";
import type { InterviewMetrics } from "@/lib/interview-metrics";
import type { InterviewStrategy } from "@/lib/response-analyzer";

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
  PIVOT_TOPIC: "Topic pivot",
  HYPOTHETICAL_TWIST: "Scenario twist",
};

function normalizeConfidence(score: number | null): number {
  if (score === null) {
    return 0;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * The interview engine's own view of the session, for the "Advanced system
 * state" dialog. A debugging surface, so it is plain: a card, three tags, two
 * meters split by a hairline, and the last decision's reason as a sentence.
 */
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
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-lg">Interview state</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Stage {stageLabel}</Badge>
          <Badge variant="outline">
            {lastStrategy
              ? STRATEGY_LABELS[lastStrategy]
              : "Strategy warming up"}
          </Badge>
          <Badge variant="outline">
            {state.followupCount} adaptive follow-ups
          </Badge>
        </div>

        <p className="text-xs leading-5 text-slate-600">{stageGuidance}</p>

        <div className="grid divide-y divide-slate-100 border-y border-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="py-3 sm:pr-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>Decision confidence</span>
              <span className="font-medium text-slate-900 tabular-nums">
                {Math.round(confidence)}%
              </span>
            </div>
            <Progress
              value={confidence}
              className="h-1.5"
              aria-label="Decision confidence"
            />
          </div>

          <div className="py-3 sm:pl-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>Communication signal</span>
              <span className="font-medium text-slate-900 tabular-nums">
                {Math.round(communication)}%
              </span>
            </div>
            <Progress
              value={communication}
              className="h-1.5"
              aria-label="Communication signal"
            />
          </div>
        </div>

        {decisionReason && (
          <p className="text-xs leading-5 text-slate-600">{decisionReason}</p>
        )}
      </CardContent>
    </Card>
  );
}
