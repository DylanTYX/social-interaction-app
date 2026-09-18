/**
 * The private note the interviewer reads before asking its next question.
 *
 * This is where the loop closes: the analyzer's verdict and the persona's dials
 * meet, and the result is the only place a dial's *numeric* effect reaches the
 * model. The persona prompt carries prose ("Pushback: high"); this block
 * carries the decisions — which strategy, what to focus on, which difficulty to
 * aim for, whether to press or go deeper.
 *
 * Lifted out of `api/chat/route.ts`, unchanged, for one reason: it could not be
 * measured where it was. The persona eval could reach `generatePersonaPrompt`
 * but not this, so it was measuring the prose and calling the result "the
 * interview" — and probingDepth and unpredictability, which appear in *no*
 * prompt text and act only through this block, came out looking inert when they
 * had simply never been given a chance to act. See `docs/PERSONA-EVAL.md`.
 */

import type {
  AnalysisResult,
  InterviewStrategy,
} from "@/lib/response-analyzer";

/**
 * How a strategy is named to the interviewer model.
 *
 * The enum is load-bearing elsewhere (analyzer schema, turn history), so it
 * keeps its name. Only the label the model reads changes: a model told
 * "ACKNOWLEDGE_STRENGTH" acknowledges, out loud, every time.
 */
export const STRATEGY_LABEL: Partial<Record<InterviewStrategy, string>> = {
  ACKNOWLEDGE_STRENGTH: "RAISE_THE_BAR",
};

/**
 * Turn the analyzer's verdict into a concise, private coaching signal that
 * tells the interviewer exactly what to probe next. This is what closes the
 * loop: the same judgment used to score the answer now shapes the follow-up.
 */
/**
 * A pivot leaves the current thread; everything else stays on it.
 *
 * This distinction is load-bearing and was missing. The block used to tell the
 * model "change direction — ask about a different competency" and then, two
 * lines later, "Focus the next question on: tradeoffs" and "The main gap to
 * test: <a gap in the story it was just told to leave>". Given three concrete
 * instructions and one abstract one, the model followed the concrete ones and
 * never pivoted — measured, not guessed: unpredictability 9 moved the blind
 * judge's topic-shift rating by 0.0 points while pushback 9, whose move is a
 * twist *within* the topic and so conflicts with nothing, moved it by 2.2
 * (`docs/PERSONA-EVAL.md`). The dial was not weak; its instruction was being
 * cancelled two lines below.
 */
function isPivot(strategy: InterviewStrategy): boolean {
  return strategy === "PIVOT_TOPIC";
}

export function buildSteeringBlock(
  analysis: AnalysisResult,
  strategy: InterviewStrategy,
  decisionReason: string,
  nextFocus: string,
  difficulty: number,
  escalate: boolean,
  slowDown: boolean,
): string {
  const pivoting = isPivot(strategy);
  // On a pivot the reason already names the destination ("A good target: …"),
  // so a second focus drawn from the old thread would contradict it.
  const topGap = pivoting ? undefined : analysis.gaps?.[0];
  const topStrength = analysis.strengths?.[0];
  const lines = [
    "Interviewer notes for your next question (private; never read out or refer to):",
    `- Their last answer scored ${Math.round(analysis.overallScore)}/100.`,
    `- Approach: ${STRATEGY_LABEL[strategy] ?? strategy} — ${decisionReason}`,
    ...(pivoting
      ? [
          "- Do not ask anything further about the story they just told. Open the new subject instead.",
        ]
      : [`- Focus the next question on: ${nextFocus}.`]),
    `- Aim for difficulty ${difficulty}/10.`,
  ];
  // What held up is still useful — it decides how far to push — but it used
  // to arrive as "Briefly acknowledge this strength first", which is how the
  // interviewer came to open every turn with a compliment.
  if (topStrength && !pivoting) {
    lines.push(
      `- What held up: ${topStrength}. Do not praise it out loud; use it to decide how far to push.`,
    );
  }
  if (topGap) {
    lines.push(`- The main gap to test: ${topGap}.`);
  }
  if (escalate) {
    lines.push(
      "- The answer was weak or repeated; be firmer and push for specifics.",
    );
  } else if (slowDown) {
    lines.push(
      "- The answer was strong; do not compliment it — go one level deeper on reasoning or tradeoffs.",
    );
  }
  return lines.join("\n");
}
