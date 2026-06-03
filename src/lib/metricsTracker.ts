import type { AnalysisResult } from "./responseAnalyzer";
import type { InterviewSessionState } from "./interviewStateMachine";

export interface InterviewMetrics {
  sessionId: string;
  personaName: string;
  turnCount: number;
  followupCount: number;
  averageOverallScore: number;
  averageSTARScore: number;
  averageSpecificityScore: number;
  averageConfidenceScore: number;
  improvementTrend: "improving" | "declining" | "stable";
  dominantGap: string;
  lastUpdated: string;
}

export interface MetricsSnapshot {
  analyses: AnalysisResult[];
  state: InterviewSessionState;
}

function getAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getTrend(values: number[]): "improving" | "declining" | "stable" {
  if (values.length < 2) {
    return "stable";
  }

  const first = values[0];
  const last = values[values.length - 1];

  if (last > first + 1) {
    return "improving";
  }

  if (last < first - 1) {
    return "declining";
  }

  return "stable";
}

function getDominantGap(analyses: AnalysisResult[]): string {
  if (analyses.length === 0) {
    return "No analysis available yet.";
  }

  const gapCounts = new Map<string, number>();

  for (const analysis of analyses) {
    for (const gap of analysis.gaps) {
      gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
    }
  }

  let dominantGap = "No dominant gap detected.";
  let dominantCount = 0;

  for (const [gap, count] of gapCounts.entries()) {
    if (count > dominantCount) {
      dominantGap = gap;
      dominantCount = count;
    }
  }

  return dominantGap;
}

export function buildInterviewMetrics(
  snapshot: MetricsSnapshot,
): InterviewMetrics {
  const { analyses, state } = snapshot;

  const overallScores = analyses.map((analysis) => analysis.overallScore);
  const specificityScores = analyses.map(
    (analysis) => analysis.specificityMetrics.vaguenessScore,
  );
  const confidenceScores = analyses.map(
    (analysis) => analysis.confidenceIndicators.assertivenessScore,
  );
  const starScores = analyses.map((analysis) => {
    if (analysis.technicalScores) {
      const scores = analysis.technicalScores;
      return (
        scores.problemFraming +
        scores.approach +
        scores.correctness +
        scores.complexity +
        scores.communication +
        scores.edgeCases +
        scores.codeQuality
      ) / 7;
    }
    const { situation, task, action, result } = analysis.starAnalysis;
    return (
      (situation.quality + task.quality + action.quality + result.quality) / 4
    );
  });

  return {
    sessionId: state.sessionId,
    personaName: state.personaName,
    turnCount: state.turnCount,
    followupCount: state.followupCount,
    averageOverallScore: getAverage(overallScores),
    averageSTARScore: getAverage(starScores),
    averageSpecificityScore: getAverage(specificityScores),
    averageConfidenceScore: getAverage(confidenceScores),
    improvementTrend: getTrend(overallScores),
    dominantGap: getDominantGap(analyses),
    lastUpdated: state.updatedAt,
  };
}

export function mergeMetricsIntoState(
  state: InterviewSessionState,
  analyses: AnalysisResult[],
): InterviewMetrics {
  return buildInterviewMetrics({ analyses, state });
}
