import { describe, expect, it } from "vitest";

import {
  decideInterviewAction,
  estimateFollowupDifficulty,
} from "@/lib/decisionEngine";
import type { AnalysisResult } from "@/lib/responseAnalyzer";

/**
 * A strong, fully-formed answer. Individual tests weaken one dimension at a
 * time so each assertion pins down exactly one branch of `chooseStrategy`.
 */
function makeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
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
    rawAnalysis: "{}",
    ...overrides,
  };
}

const base = { personaName: "Alex" };

describe("decideInterviewAction — strategy selection", () => {
  it("asks for context first when the situation is missing", () => {
    const analysis = makeAnalysis();
    analysis.starAnalysis.situation.present = false;

    expect(decideInterviewAction(analysis, base).strategy).toBe(
      "CLARIFY_SITUATION",
    );
  });

  it("drills for specifics when the action is vague", () => {
    const analysis = makeAnalysis();
    analysis.starAnalysis.action.specificity = 2;

    expect(decideInterviewAction(analysis, base).strategy).toBe(
      "DRILL_SPECIFICITY",
    );
  });

  it("challenges ownership when the candidate hides behind the team", () => {
    const analysis = makeAnalysis();
    analysis.starAnalysis.action.ownership = 3;

    expect(decideInterviewAction(analysis, base).strategy).toBe(
      "CHALLENGE_OWNERSHIP",
    );
  });

  it("probes impact when the result is not quantified", () => {
    const analysis = makeAnalysis();
    analysis.starAnalysis.result.quantified = false;

    expect(decideInterviewAction(analysis, base).strategy).toBe(
      "EXPLORE_RESULT",
    );
  });

  it("acknowledges a strong answer", () => {
    expect(decideInterviewAction(makeAnalysis(), base).strategy).toBe(
      "ACKNOWLEDGE_STRENGTH",
    );
  });

  it("probes the action for a merely adequate answer", () => {
    expect(
      decideInterviewAction(makeAnalysis({ overallScore: 60 }), base).strategy,
    ).toBe("PROBE_ACTION");
  });
});

describe("decideInterviewAction — escalation", () => {
  it("escalates on a weak answer", () => {
    const decision = decideInterviewAction(
      makeAnalysis({ overallScore: 30 }),
      base,
    );
    expect(decision.shouldEscalate).toBe(true);
  });

  it("escalates when the previous strategy is repeated", () => {
    const decision = decideInterviewAction(makeAnalysis(), {
      ...base,
      previousStrategy: "ACKNOWLEDGE_STRENGTH",
    });

    expect(decision.shouldEscalate).toBe(true);
    expect(decision.reason).toContain("escalate");
  });

  it("slows down only for a strong answer from a warm persona", () => {
    expect(
      decideInterviewAction(makeAnalysis(), { ...base, warmth: 8 })
        .shouldSlowDown,
    ).toBe(true);

    expect(
      decideInterviewAction(makeAnalysis(), { ...base, warmth: 3 })
        .shouldSlowDown,
    ).toBe(false);
  });

  it("does not escalate a strong, non-repeated answer", () => {
    expect(decideInterviewAction(makeAnalysis(), base).shouldEscalate).toBe(
      false,
    );
  });
});

describe("decideInterviewAction — confidence and focus", () => {
  it("clamps confidence into 20..95", () => {
    const strict = decideInterviewAction(makeAnalysis(), {
      ...base,
      strictness: 10,
      warmth: 0,
    });
    expect(strict.confidence).toBeLessThanOrEqual(95);

    const weak = decideInterviewAction(
      makeAnalysis({
        overallScore: 0,
        specificityMetrics: {
          ...makeAnalysis().specificityMetrics,
          vaguenessScore: 10,
        },
        confidenceIndicators: {
          ...makeAnalysis().confidenceIndicators,
          assertivenessScore: 0,
        },
      }),
      { ...base, strictness: 0, warmth: 10 },
    );
    expect(weak.confidence).toBeGreaterThanOrEqual(20);
  });

  it("uses the analyzer's first follow-up topic as the next focus", () => {
    expect(decideInterviewAction(makeAnalysis(), base).nextFocus).toBe(
      "tradeoffs",
    );
  });

  it("falls back to a sensible focus when the analyzer offers none", () => {
    expect(
      decideInterviewAction(makeAnalysis({ followupTopics: [] }), base)
        .nextFocus,
    ).toBe("deeper reasoning");
  });
});

describe("estimateFollowupDifficulty", () => {
  it("scales with the answer's score", () => {
    expect(estimateFollowupDifficulty(makeAnalysis({ overallScore: 80 }), base))
      .toBe(8);
    expect(estimateFollowupDifficulty(makeAnalysis({ overallScore: 20 }), base))
      .toBe(2);
  });

  it("stays within 1..10 at the extremes", () => {
    const hardest = estimateFollowupDifficulty(
      makeAnalysis({ overallScore: 100 }),
      { ...base, strictness: 10, warmth: 0, previousStrategy: "PROBE_ACTION" },
    );
    expect(hardest).toBeLessThanOrEqual(10);

    const easiest = estimateFollowupDifficulty(
      makeAnalysis({ overallScore: 0 }),
      { ...base, strictness: 0, warmth: 10 },
    );
    expect(easiest).toBeGreaterThanOrEqual(1);
  });
});
