import { isTechnicalRound } from "./round-types";
import type {
  AnalysisResult,
  InterviewStrategy,
  STARAnalysis,
  TechnicalScores,
} from "./response-analyzer";

export interface DecisionContext {
  personaName: string;
  previousStrategy?: InterviewStrategy;
  responseCount?: number;
  strictness?: number;
  warmth?: number;
}

export interface DecisionOutcome {
  strategy: InterviewStrategy;
  reason: string;
  confidence: number;
  shouldEscalate: boolean;
  shouldSlowDown: boolean;
  nextFocus: string;
}

/** Rounds judged on the technical rubric rather than STAR. */

/**
 * The analyzer's JSON is model-generated and not schema-validated, so any
 * individual field can come back missing or non-numeric. Coerce to a neutral
 * mid-scale value rather than letting `undefined` poison the arithmetic — an
 * absent field should not read as a score of zero.
 */
function score(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 5;
}

function averageStar(star: STARAnalysis): number {
  return (
    (score(star?.situation?.quality) +
      score(star?.task?.quality) +
      score(star?.action?.quality) +
      score(star?.result?.quality)) /
    4
  );
}

function averageTechnical(scores: TechnicalScores): number {
  return (
    (score(scores.problemFraming) +
      score(scores.approach) +
      score(scores.correctness) +
      score(scores.complexity) +
      score(scores.communication) +
      score(scores.edgeCases) +
      score(scores.codeQuality)) /
    7
  );
}

/**
 * Which rubric governs this answer.
 *
 * Prefer the presence of `technicalScores`, falling back to the round type so a
 * technical round whose analyzer response omitted the block is still not judged
 * on STAR.
 */
function usesTechnicalRubric(analysis: AnalysisResult): boolean {
  if (analysis.technicalScores) return true;
  return isTechnicalRound(analysis.roundType);
}

function getVaguenessWeight(analysis: AnalysisResult): number {
  const baseVagueness = score(analysis.specificityMetrics?.vaguenessScore);
  const lowConfidencePenalty =
    10 - score(analysis.confidenceIndicators?.assertivenessScore);

  // On a technical round the analyzer is instructed to emit a *zeroed* STAR
  // block, because STAR is not the rubric in play. Scoring that block added a
  // flat +5 penalty to every technical answer and pushed `shouldEscalate` over
  // its threshold almost every turn. Weigh whichever rubric actually applies.
  const rubricPenalty = usesTechnicalRubric(analysis)
    ? 10 -
      Math.round(
        analysis.technicalScores ? averageTechnical(analysis.technicalScores) : 5,
      )
    : 10 - Math.round(averageStar(analysis.starAnalysis));

  return baseVagueness + lowConfidencePenalty / 2 + rubricPenalty / 2;
}

/**
 * Behavioural / screening rounds: walk the STAR elements in dependency order.
 */
function chooseBehavioralStrategy(analysis: AnalysisResult): InterviewStrategy {
  const { starAnalysis, specificityMetrics } = analysis;

  if (!starAnalysis.situation.present || !starAnalysis.task.present) {
    return "CLARIFY_SITUATION";
  }

  if (starAnalysis.action.specificity < 4) {
    return "DRILL_SPECIFICITY";
  }

  if (starAnalysis.action.ownership < 5) {
    return "CHALLENGE_OWNERSHIP";
  }

  if (!starAnalysis.result.present || !starAnalysis.result.quantified) {
    return "EXPLORE_RESULT";
  }

  if (specificityMetrics.vaguenessScore > 6) {
    return "DRILL_SPECIFICITY";
  }

  if (analysis.overallScore > 75) {
    return "ACKNOWLEDGE_STRENGTH";
  }

  return "PROBE_ACTION";
}

/**
 * Technical / system-design / case rounds.
 *
 * Mirrors the behavioural ladder but over the technical rubric, in the order a
 * real interviewer would unblock: did they understand the problem, can they
 * articulate an approach, is it correct, do they know its cost and failure
 * modes, and did they own the design decisions.
 *
 * This path did not exist before: `chooseStrategy` read only `starAnalysis`,
 * which the analyzer zeroes out on technical rounds, so `situation.present`
 * was always false and every technical turn returned CLARIFY_SITUATION — the
 * interviewer opened each system-design question with "tell me about the
 * situation and task".
 */
function chooseTechnicalStrategy(analysis: AnalysisResult): InterviewStrategy {
  const t = analysis.technicalScores;

  // No technical block despite a technical round: fall through on overall
  // score rather than inventing sub-scores.
  if (!t) {
    return analysis.overallScore > 75 ? "ACKNOWLEDGE_STRENGTH" : "PROBE_ACTION";
  }

  // Everything downstream is meaningless if they misread the problem.
  if (score(t.problemFraming) < 5) {
    return "CLARIFY_SITUATION";
  }

  // Reasoning made visible is the thing under assessment here.
  if (score(t.approach) < 5 || score(t.communication) < 4) {
    return "ASSESS_THINKING";
  }

  if (score(t.correctness) < 5) {
    return "PROBE_ACTION";
  }

  // Cost and failure modes — the usual gap between a working answer and a
  // senior one.
  if (score(t.complexity) < 5 || score(t.edgeCases) < 5) {
    return "DRILL_SPECIFICITY";
  }

  // A recited pattern scores well until you ask why they chose it.
  if (score(t.codeQuality) < 5) {
    return "CHALLENGE_OWNERSHIP";
  }

  if (analysis.overallScore > 75) {
    return "ACKNOWLEDGE_STRENGTH";
  }

  return "PROBE_ACTION";
}

function chooseStrategy(analysis: AnalysisResult): InterviewStrategy {
  return usesTechnicalRubric(analysis)
    ? chooseTechnicalStrategy(analysis)
    : chooseBehavioralStrategy(analysis);
}

/**
 * The reason is not just for display — `buildSteeringBlock` injects it verbatim
 * into the interviewer's prompt as "Recommended approach: X — <reason>". So it
 * has to describe the rubric actually in play; telling the model to "ask for
 * the situation and task" on a system-design question is what produced the
 * behaviour this fix removes.
 */
const REASONS: Record<
  "behavioral" | "technical",
  Record<InterviewStrategy, string>
> = {
  behavioral: {
    CLARIFY_SITUATION:
      "Key context is missing, so ask for the situation and task first.",
    DRILL_SPECIFICITY: "The answer is too vague, so ask for concrete details.",
    CHALLENGE_OWNERSHIP:
      "Ownership looks weak, so push on the candidate's personal role.",
    EXPLORE_RESULT:
      "The result is not clear or quantified, so probe for impact.",
    ACKNOWLEDGE_STRENGTH:
      "The response is strong, so acknowledge it and push deeper.",
    PROBE_ACTION:
      "The answer is usable, but the action details need more depth.",
    ASSESS_THINKING:
      "The reasoning is not visible, so ask them to think out loud.",
  },
  technical: {
    CLARIFY_SITUATION:
      "The problem has been mis-framed, so pin down requirements and constraints before anything else.",
    DRILL_SPECIFICITY:
      "Complexity and edge cases are unaddressed, so ask what it costs and where it breaks.",
    CHALLENGE_OWNERSHIP:
      "The design reads as a recited pattern, so ask why they chose it over the alternatives.",
    EXPLORE_RESULT:
      "The outcome is unclear, so ask what the solution actually achieves and how they would measure it.",
    ACKNOWLEDGE_STRENGTH:
      "The solution is strong, so acknowledge it and raise the difficulty — scale it up or add a constraint.",
    PROBE_ACTION:
      "The approach is sound but the solution is incomplete, so probe the implementation.",
    ASSESS_THINKING:
      "The approach is unclear, so make them reason out loud through their thinking.",
  },
};

export function decideInterviewAction(
  analysis: AnalysisResult,
  context: DecisionContext,
): DecisionOutcome {
  const strategy = chooseStrategy(analysis);
  const vaguenessWeight = getVaguenessWeight(analysis);
  const previousStrategy = context.previousStrategy;

  const repeatedStrategy = previousStrategy === strategy;
  const strictness = context.strictness ?? 5;
  const warmth = context.warmth ?? 5;

  const confidence = Math.max(
    20,
    Math.min(
      95,
      Math.round(
        analysis.overallScore * 0.55 +
          (10 - analysis.specificityMetrics.vaguenessScore) * 3 +
          analysis.confidenceIndicators.assertivenessScore * 2 +
          strictness * 1.5 +
          (10 - warmth) * 0.5,
      ),
    ),
  );

  const shouldEscalate =
    analysis.overallScore < 45 || vaguenessWeight > 12 || repeatedStrategy;
  const shouldSlowDown =
    analysis.overallScore > 78 && warmth >= 7 && !repeatedStrategy;

  let reason = REASONS[usesTechnicalRubric(analysis) ? "technical" : "behavioral"][
    strategy
  ];

  if (repeatedStrategy) {
    reason +=
      " The previous strategy was repeated, so the next question should escalate slightly.";
  }

  return {
    strategy,
    reason,
    confidence,
    shouldEscalate,
    shouldSlowDown,
    nextFocus: analysis.followupTopics?.[0] ?? defaultFocus(analysis, strategy),
  };
}

/** Fallback when the analyzer suggested no follow-up topics. */
function defaultFocus(
  analysis: AnalysisResult,
  strategy: InterviewStrategy,
): string {
  if (strategy === "ACKNOWLEDGE_STRENGTH") return "deeper reasoning";
  return usesTechnicalRubric(analysis)
    ? "the concrete approach and its tradeoffs"
    : "specific examples";
}

export function estimateFollowupDifficulty(
  analysis: AnalysisResult,
  context: DecisionContext,
): number {
  const base = Math.max(
    1,
    Math.min(10, Math.round(analysis.overallScore / 10)),
  );
  const strictness = context.strictness ?? 5;
  const warmth = context.warmth ?? 5;
  // Boost only when we are about to repeat ourselves. The old test —
  // `context.previousStrategy ? 1 : 0` — fired on every turn after the first,
  // which is not what "repetition" means; it was masked because
  // `previousStrategy` was never actually supplied in production.
  const repetitionBoost =
    context.previousStrategy && context.previousStrategy === chooseStrategy(analysis)
      ? 1
      : 0;

  return Math.max(
    1,
    Math.min(
      10,
      Math.round(base + repetitionBoost + (strictness - warmth) / 4),
    ),
  );
}
