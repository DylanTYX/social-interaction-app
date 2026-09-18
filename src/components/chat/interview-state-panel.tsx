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

/**
 * What each move actually is, in the engine's own terms.
 *
 * Four of these used to describe something else entirely: `CLARIFY_SITUATION`
 * was labelled "Behavioral probing" when it fires because context is missing,
 * `DRILL_SPECIFICITY` was "STAR-format evaluation" when it fires because an
 * answer was vague, `PROBE_ACTION` was "Technical depth assessment" on a
 * behavioural ladder that never touches the technical rubric, and
 * `ASSESS_THINKING` was "Communication analysis" when it asks the candidate to
 * reason aloud. This is the one screen that claims to show the machinery, so a
 * label that misdescribes it is worse than no label.
 *
 * Each line below is the short form of that strategy's entry in `REASONS`
 * (`decision-engine.ts`). If those change, these are wrong.
 */
const STRATEGY_LABELS: Record<InterviewStrategy, string> = {
  CLARIFY_SITUATION: "Asking for the missing context",
  DRILL_SPECIFICITY: "Pressing for specifics",
  CHALLENGE_OWNERSHIP: "Testing personal ownership",
  EXPLORE_RESULT: "Probing the outcome",
  ACKNOWLEDGE_STRENGTH: "Raising the bar",
  PROBE_ACTION: "Going deeper on the actions",
  ASSESS_THINKING: "Asking them to think aloud",
  PIVOT_TOPIC: "Changing subject",
  HYPOTHETICAL_TWIST: "Twisting the scenario",
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

/** One labelled meter, or a stated absence. Never a stand-in number. */
function Meter({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: number | null;
}) {
  return (
    <div className="py-3 first:pt-0 sm:py-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-slate-900 tabular-nums">
          {value === null ? "not yet" : `${Math.round(value)}%`}
        </span>
      </div>
      <Progress
        value={value ?? 0}
        className={value === null ? "h-1.5 opacity-40" : "h-1.5"}
        aria-label={label}
      />
      <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{hint}</p>
    </div>
  );
}

/**
 * The interview engine's own view of the session, for the "Advanced system
 * state" dialog.
 *
 * A debugging surface, so it is plain — but its whole value is being accurate,
 * and it was not. Besides the mislabelled strategies above, "Decision
 * confidence" silently fell back to the candidate's *average answer score* when
 * the engine had not produced a confidence yet: two unrelated quantities under
 * one label, with nothing to say which you were looking at. A meter now reads
 * "not yet" rather than borrowing a number from somewhere else.
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
  const confidence =
    decisionConfidence === null ? null : clamp(decisionConfidence);
  // `averageConfidenceScore` is the analyzer's assertiveness rating, 0-10. It
  // is not "communication", and calling it that invited the reading that the
  // interview was scoring how well the candidate communicates overall.
  const assertiveness = metrics
    ? clamp(metrics.averageConfidenceScore * 10)
    : null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-lg">Interview state</CardTitle>
        <p className="text-xs leading-5 text-slate-500">
          What the engine decided on the last scored answer, and why. Nothing
          here is shown to the interviewer as text &mdash; it is the record of
          the choice, not the prompt.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Stage {stageLabel}</Badge>
          <Badge variant="outline">
            {lastStrategy
              ? STRATEGY_LABELS[lastStrategy]
              : "No decision yet"}
          </Badge>
          <Badge variant="outline">
            {state.turnCount} scored {state.turnCount === 1 ? "answer" : "answers"}
          </Badge>
          <Badge variant="outline">
            {state.followupCount} adaptive follow-ups
          </Badge>
        </div>

        <p className="text-xs leading-5 text-slate-600">{stageGuidance}</p>

        <div className="grid gap-4 divide-y divide-slate-100 border-y border-slate-100 py-3 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:gap-0">
          <div className="sm:pr-5">
            <Meter
              label="Decision confidence"
              hint="How settled the engine was on this move, from the answer's score, its vagueness, and the persona's strictness and warmth."
              value={confidence}
            />
          </div>
          <div className="sm:pl-5">
            <Meter
              label="Assertiveness in answers"
              hint="The analyzer's read of how assertively the candidate has been speaking, averaged over scored answers. Not part of the interview score."
              value={assertiveness}
            />
          </div>
        </div>

        {decisionReason ? (
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              Why this move
            </p>
            <p className="text-xs leading-5 text-slate-600">{decisionReason}</p>
          </div>
        ) : (
          <p className="text-xs leading-5 text-slate-500">
            The first answer has not been scored yet, so no move has been chosen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
