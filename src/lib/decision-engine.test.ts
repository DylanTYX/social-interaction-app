import { describe, expect, it } from "vitest";

import {
  decideInterviewAction,
  estimateFollowupDifficulty,
} from "@/lib/decision-engine";
import type { AnalysisResult } from "@/lib/response-analyzer";

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
    ...overrides,
  };
}

/**
 * A technical-round analysis. The analyzer deliberately emits a *zeroed* STAR
 * block on these rounds (STAR is not the rubric in play) and fills
 * `technicalScores` instead — so these fixtures reproduce the exact shape that
 * used to send the decision engine down the behavioural path.
 */
function makeTechnicalAnalysis(
  overrides: Partial<AnalysisResult> = {},
): AnalysisResult {
  return {
    ...makeAnalysis(),
    roundType: "system_design",
    starAnalysis: {
      situation: { present: false, quality: 0, context: "not primary rubric" },
      task: { present: false, quality: 0, clarity: "not primary rubric" },
      action: {
        present: false,
        quality: 0,
        specificity: 0,
        ownership: 0,
        summary: "not primary rubric",
      },
      result: {
        present: false,
        quality: 0,
        quantified: false,
        impact: "not primary rubric",
      },
    },
    technicalScores: {
      problemFraming: 8,
      approach: 8,
      correctness: 8,
      complexity: 8,
      communication: 8,
      edgeCases: 8,
      codeQuality: 8,
    },
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

describe("decideInterviewAction — technical rounds", () => {
  it("does NOT fall back to CLARIFY_SITUATION on a zeroed STAR block", () => {
    // Regression guard. `chooseStrategy` used to read only `starAnalysis`, so
    // `situation.present === false` made every technical turn return
    // CLARIFY_SITUATION and the interviewer opened each system-design question
    // with "tell me about the situation and task".
    const decision = decideInterviewAction(makeTechnicalAnalysis(), base);

    expect(decision.strategy).not.toBe("CLARIFY_SITUATION");
    expect(decision.strategy).toBe("ACKNOWLEDGE_STRENGTH");
  });

  it("pins down requirements when the problem is mis-framed", () => {
    const analysis = makeTechnicalAnalysis();
    analysis.technicalScores!.problemFraming = 2;

    const decision = decideInterviewAction(analysis, base);
    expect(decision.strategy).toBe("CLARIFY_SITUATION");
    // ...but for the technical reason, not the STAR one.
    expect(decision.reason).toContain("requirements and constraints");
  });

  it("asks for visible reasoning when the approach is unclear", () => {
    const analysis = makeTechnicalAnalysis();
    analysis.technicalScores!.approach = 3;

    expect(decideInterviewAction(analysis, base).strategy).toBe(
      "ASSESS_THINKING",
    );
  });

  it("probes the implementation when the solution is wrong", () => {
    const analysis = makeTechnicalAnalysis();
    analysis.technicalScores!.correctness = 3;

    expect(decideInterviewAction(analysis, base).strategy).toBe("PROBE_ACTION");
  });

  it("drills cost and failure modes when complexity or edge cases are weak", () => {
    const complexity = makeTechnicalAnalysis();
    complexity.technicalScores!.complexity = 2;
    expect(decideInterviewAction(complexity, base).strategy).toBe(
      "DRILL_SPECIFICITY",
    );

    const edges = makeTechnicalAnalysis();
    edges.technicalScores!.edgeCases = 2;
    expect(decideInterviewAction(edges, base).strategy).toBe(
      "DRILL_SPECIFICITY",
    );
  });

  it("does not apply the zeroed-STAR penalty to escalation", () => {
    // The zeroed STAR block used to add a flat +5 to `vaguenessWeight`,
    // pushing it past the escalation threshold on nearly every technical turn.
    expect(decideInterviewAction(makeTechnicalAnalysis(), base).shouldEscalate)
      .toBe(false);
  });

  it("uses the technical rubric when the round is technical but the block is missing", () => {
    // Defensive: the analyzer's JSON is not schema-validated, so the technical
    // block can be absent. Falling back to the zeroed STAR would resurrect the
    // original bug.
    const analysis = makeTechnicalAnalysis({ technicalScores: undefined });

    expect(decideInterviewAction(analysis, base).strategy).not.toBe(
      "CLARIFY_SITUATION",
    );
  });

  it("gives a technical next-focus fallback when no topics are suggested", () => {
    const analysis = makeTechnicalAnalysis({
      followupTopics: [],
      overallScore: 60,
    });

    expect(decideInterviewAction(analysis, base).nextFocus).toBe(
      "the concrete approach and its tradeoffs",
    );
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
