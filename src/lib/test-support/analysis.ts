import type { AnalysisResult } from "@/lib/response-analyzer";

/**
 * A strong behavioural analysis, as the analyzer would emit one.
 *
 * Lifted out of `decision-engine.test.ts` when `persona-engine.test.ts` needed
 * the same shape. `AnalysisResult` has five nested objects and ten required
 * fields, so a second hand-rolled copy would have drifted from the first the
 * moment the interface changed.
 */
export function makeAnalysis(
  overrides: Partial<AnalysisResult> = {},
): AnalysisResult {
  return {
    overallScore: 80,
    starAnalysis: {
      situation: { present: true, quality: 8, context: "" },
      task: { present: true, quality: 8, clarity: "" },
      action: {
        present: true,
        quality: 8,
        specificity: 8,
        ownership: 8,
        summary: "",
      },
      result: { present: true, quality: 8, quantified: true, impact: "" },
    },
    specificityMetrics: {
      hasMetrics: true,
      metricCount: 2,
      hasTimeframes: true,
      hasStakeholders: true,
      vaguenessScore: 2,
      concreteExamples: 2,
    },
    confidenceIndicators: {
      hesitationMarkers: 0,
      assertivenessScore: 8,
      qualificationCount: 0,
      revisionsCount: 0,
      clarity: 8,
    },
    responseQuality: {
      length: 120,
      isRelevant: true,
      addressesExplicitly: true,
      depthLevel: "deep",
      thinkingVisible: true,
    },
    strengths: ["clear ownership"],
    gaps: [],
    followupTopics: ["tradeoffs"],
    ...overrides,
  };
}
