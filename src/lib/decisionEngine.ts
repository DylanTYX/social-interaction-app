import type { AnalysisResult, InterviewStrategy } from "./responseAnalyzer";

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

function getVaguenessWeight(analysis: AnalysisResult): number {
  const baseVagueness = analysis.specificityMetrics.vaguenessScore;
  const lowConfidencePenalty =
    10 - analysis.confidenceIndicators.assertivenessScore;
  const lowSTARPenalty =
    10 -
    Math.round(
      (analysis.starAnalysis.situation.quality +
        analysis.starAnalysis.task.quality +
        analysis.starAnalysis.action.quality +
        analysis.starAnalysis.result.quality) /
        4,
    );

  return baseVagueness + lowConfidencePenalty / 2 + lowSTARPenalty / 2;
}

function chooseStrategy(analysis: AnalysisResult): InterviewStrategy {
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

  let reason = "Balanced interview follow-up selected.";
  if (strategy === "CLARIFY_SITUATION") {
    reason = "Key context is missing, so ask for the situation and task first.";
  } else if (strategy === "DRILL_SPECIFICITY") {
    reason = "The answer is too vague, so ask for concrete details.";
  } else if (strategy === "CHALLENGE_OWNERSHIP") {
    reason = "Ownership looks weak, so push on the candidate's personal role.";
  } else if (strategy === "EXPLORE_RESULT") {
    reason = "The result is not clear or quantified, so probe for impact.";
  } else if (strategy === "ACKNOWLEDGE_STRENGTH") {
    reason = "The response is strong, so acknowledge it and push deeper.";
  } else if (strategy === "PROBE_ACTION") {
    reason = "The answer is usable, but the action details need more depth.";
  }

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
    nextFocus:
      analysis.followupTopics[0] ??
      (strategy === "ACKNOWLEDGE_STRENGTH"
        ? "deeper reasoning"
        : "specific examples"),
  };
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
  const repetitionBoost = context.previousStrategy ? 1 : 0;

  return Math.max(
    1,
    Math.min(
      10,
      Math.round(base + repetitionBoost + (strictness - warmth) / 4),
    ),
  );
}
