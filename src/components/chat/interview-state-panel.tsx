import { PANEL_LABEL } from "@/components/dashboard/page-header";
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

const percent = (value: number | null) =>
  value === null ? null : Math.round(Math.max(0, Math.min(100, value)));

type Measure = {
  label: string;
  value: number | string | null;
  unit?: string;
  caption: string;
};

/**
 * The interview engine's own view of the session, for the "Advanced system
 * state" dialog.
 *
 * Drawn as the rail's readout is drawn — a panel label, a hairline grid of
 * measures, navy figures with captions — because it is the same kind of thing
 * and was previously the only readout in the app with progress bars and a card
 * of its own inside a dialog that already framed it. No tone marks: nothing
 * here is a judgement about the candidate, and the delivery readout's rule is
 * that a mark appears only where the code actually makes one.
 *
 * Its value is being accurate, and it was not. Besides the mislabelled
 * strategies above, "Decision confidence" silently fell back to the candidate's
 * *average answer score* when the engine had not produced a confidence yet: two
 * unrelated quantities under one label, with nothing to say which you were
 * looking at. An absent measure now reads as absent.
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
  const measures: Measure[] = [
    {
      label: "Scored answers",
      value: state.turnCount,
      caption: "Trivial replies are not counted.",
    },
    {
      label: "Adaptive follow-ups",
      value: state.followupCount,
      caption: "Questions chosen from your answer rather than a script.",
    },
    {
      label: "Decision confidence",
      value: percent(decisionConfidence),
      unit: "%",
      caption:
        "How settled the engine was on this move, from the answer's score, its vagueness and the persona's strictness and warmth.",
    },
    {
      label: "Assertiveness",
      // `averageConfidenceScore` is the analyzer's assertiveness rating, 0-10.
      // It is not "communication", which is what this used to be called — a
      // name that invited the reading that the interview scores how well you
      // communicate overall.
      value: percent(metrics ? metrics.averageConfidenceScore * 10 : null),
      unit: "%",
      caption: "How assertively you have been answering. Not part of your score.",
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className={PANEL_LABEL}>Where this interview is</h3>
          <p className="text-xs text-slate-500">{stageLabel}</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-pretty text-slate-600">
          {stageGuidance}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:grid-cols-4">
          {measures.map((measure) => (
            <div key={measure.label} className="bg-white p-4">
              <dt className="text-xs text-slate-500">{measure.label}</dt>
              <dd className="mt-2 font-display text-2xl leading-none font-bold tracking-tight text-navy tabular-nums">
                {measure.value === null ? (
                  <span className="text-slate-300">&mdash;</span>
                ) : (
                  <>
                    {measure.value}
                    {measure.unit && (
                      <span className="ml-0.5 font-sans text-xs font-medium tracking-normal text-slate-500">
                        {measure.unit}
                      </span>
                    )}
                  </>
                )}
              </dd>
              <dd className="mt-2 text-xs leading-snug text-slate-600">
                {measure.value === null ? "Not measured yet." : measure.caption}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className={PANEL_LABEL}>The move it chose last</h3>
          <p className="text-xs text-slate-500">
            Never shown to the interviewer as text
          </p>
        </div>

        {lastStrategy ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-display text-lg font-semibold tracking-tight text-slate-900">
              {STRATEGY_LABELS[lastStrategy]}
            </p>
            {decisionReason && (
              <p className="mt-2 text-sm leading-6 text-pretty text-slate-600">
                {decisionReason}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-500">
            The first answer has not been scored yet, so no move has been
            chosen. Until then the interviewer follows the round&rsquo;s own
            playbook.
          </p>
        )}
      </section>
    </div>
  );
}
