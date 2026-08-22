import { describe, expect, it } from "vitest";

import {
  decideInterviewAction,
  estimateFollowupDifficulty,
} from "@/lib/decision-engine";
import type { AnalysisResult } from "@/lib/response-analyzer";
import { makeAnalysis } from "@/lib/test-support/analysis";

/**
 * A strong, fully-formed answer. Individual tests weaken one dimension at a
 * time so each assertion pins down exactly one branch of `chooseStrategy`.
 */

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
    expect(
      decideInterviewAction(makeTechnicalAnalysis(), base).shouldEscalate,
    ).toBe(false);
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
    expect(
      estimateFollowupDifficulty(makeAnalysis({ overallScore: 80 }), base),
    ).toBe(8);
    expect(
      estimateFollowupDifficulty(makeAnalysis({ overallScore: 20 }), base),
    ).toBe(2);
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

/**
 * Evidence probes — the policy half of the behavioral signal taxonomy.
 * The strong `makeAnalysis()` baseline picks ACKNOWLEDGE_STRENGTH, which is
 * probe-replaceable, so each test adds exactly the signal under test.
 */
describe("evidence probes", () => {
  const withSignals = (
    signals: { type: string; markers: string[] }[],
    overrides: Partial<AnalysisResult> = {},
  ): AnalysisResult =>
    makeAnalysis({
      ...overrides,
      languageSignals: {
        signals: signals as AnalysisResult["languageSignals"] extends
          { signals: infer S } | undefined
          ? S
          : never,
        firstPersonSingular: 1,
        firstPersonPlural: 0,
      },
    });

  const context = { personaName: "Test" };

  it("quotes the candidate's exact word in the decision reason", () => {
    const outcome = decideInterviewAction(
      withSignals([{ type: "OWNERSHIP_AMBIGUOUS", markers: ["helped with"] }]),
      context,
    );
    expect(outcome.strategy).toBe("CHALLENGE_OWNERSHIP");
    expect(outcome.reason).toContain('"helped with"');
  });

  it("treats a leadership claim as a verification probe, not praise", () => {
    const outcome = decideInterviewAction(
      withSignals([
        { type: "LEADERSHIP_CLAIM_UNVERIFIED", markers: ["i led"] },
      ]),
      context,
    );
    expect(outcome.strategy).toBe("PROBE_ACTION");
    expect(outcome.reason).toContain('"i led"');
    expect(outcome.reason).toContain("verify");
  });

  it("keeps fundamentals ahead of probes", () => {
    // A misread question gets clarified, not cross-examined about a hedge
    // word inside its misunderstanding.
    const analysis = withSignals(
      [{ type: "OWNERSHIP_AMBIGUOUS", markers: ["helped with"] }],
      {
        starAnalysis: {
          ...makeAnalysis().starAnalysis,
          situation: { present: false, quality: 0, context: "" },
        },
      },
    );
    expect(decideInterviewAction(analysis, context).strategy).toBe(
      "CLARIFY_SITUATION",
    );
  });

  it("gates lower-priority signals behind probingDepth", () => {
    const learning = withSignals([
      { type: "LEARNING_UNVERIFIED", markers: ["i learned"] },
    ]);
    // Last-priority signal: silent at depth 1, probed at depth 10.
    expect(
      decideInterviewAction(learning, { ...context, probingDepth: 1 }).reason,
    ).not.toContain('"i learned"');
    expect(
      decideInterviewAction(learning, { ...context, probingDepth: 10 }).reason,
    ).toContain('"i learned"');
  });

  it("fires the hard trigger at any depth", () => {
    // Two diffuse phrases, no leadership claim: the professor's headline case
    // bypasses the gate — even the gentlest interviewer asks whose work it was.
    const diffuse = withSignals([
      {
        type: "OWNERSHIP_AMBIGUOUS",
        markers: ["was involved in", "helped with"],
      },
    ]);
    const outcome = decideInterviewAction(diffuse, {
      ...context,
      probingDepth: 1,
    });
    expect(outcome.strategy).toBe("CHALLENGE_OWNERSHIP");
    expect(outcome.reason).toContain('"was involved in"');
  });

  it("changes nothing for analyses without signals", () => {
    // Rows persisted before the taxonomy existed take the classic ladder.
    const outcome = decideInterviewAction(makeAnalysis(), context);
    expect(outcome.strategy).toBe("ACKNOWLEDGE_STRENGTH");
  });
});

/**
 * Curveballs — seeded, biased, and bounded by the precedence rule.
 */
describe("maybeCurveball", () => {
  const seededContext = (
    overrides: Partial<Parameters<typeof decideInterviewAction>[1]> = {},
  ) => ({
    personaName: "Test",
    seed: { sessionId: "session-a", turnIndex: 3 },
    ...overrides,
  });

  it("is deterministic for a given seed", () => {
    const context = seededContext({ unpredictability: 10 });
    const first = decideInterviewAction(makeAnalysis(), context);
    const second = decideInterviewAction(makeAnalysis(), context);
    expect(first.strategy).toBe(second.strategy);
    expect(first.reason).toBe(second.reason);
  });

  it("never replaces a weakness-driven strategy", () => {
    // Vague answer -> DRILL_SPECIFICITY, at any unpredictability, any seed.
    const vague = makeAnalysis({
      starAnalysis: {
        ...makeAnalysis().starAnalysis,
        action: {
          present: true,
          quality: 5,
          specificity: 2,
          ownership: 8,
          summary: "",
        },
      },
    });
    for (let turn = 0; turn < 20; turn++) {
      const outcome = decideInterviewAction(vague, {
        ...seededContext({ unpredictability: 10 }),
        seed: { sessionId: "session-a", turnIndex: turn },
      });
      expect(outcome.strategy).toBe("DRILL_SPECIFICITY");
    }
  });

  it("never fires at unpredictability 1 or without a seed", () => {
    for (let turn = 0; turn < 20; turn++) {
      expect(
        decideInterviewAction(makeAnalysis(), {
          ...seededContext({ unpredictability: 1 }),
          seed: { sessionId: "session-a", turnIndex: turn },
        }).strategy,
      ).toBe("ACKNOWLEDGE_STRENGTH");
    }
    expect(
      decideInterviewAction(makeAnalysis(), {
        personaName: "Test",
        unpredictability: 10,
      }).strategy,
    ).toBe("ACKNOWLEDGE_STRENGTH");
  });

  it("fires more with the dial higher", () => {
    const count = (unpredictability: number) => {
      let curveballs = 0;
      for (let turn = 0; turn < 50; turn++) {
        const outcome = decideInterviewAction(makeAnalysis(), {
          ...seededContext({ unpredictability }),
          seed: { sessionId: "sweep", turnIndex: turn },
        });
        if (
          outcome.strategy === "PIVOT_TOPIC" ||
          outcome.strategy === "HYPOTHETICAL_TWIST"
        ) {
          curveballs += 1;
        }
      }
      return curveballs;
    };
    expect(count(9)).toBeGreaterThan(count(3));
    expect(count(3)).toBeGreaterThan(0);
  });

  it("pivots toward an uncovered competency, twists without one", () => {
    // Without a destination the pivot is the weaker move, so the twist wins.
    let sawPivot = false;
    for (let turn = 0; turn < 50; turn++) {
      const bare = decideInterviewAction(makeAnalysis(), {
        ...seededContext({ unpredictability: 10 }),
        seed: { sessionId: "no-coverage", turnIndex: turn },
      });
      expect(bare.strategy).not.toBe("PIVOT_TOPIC");

      const covered = decideInterviewAction(makeAnalysis(), {
        ...seededContext({
          unpredictability: 10,
          pushback: 2,
          questioningStyle: "conversational",
          uncoveredCompetency: "how they handle production incidents",
        }),
        seed: { sessionId: "no-coverage", turnIndex: turn },
      });
      if (covered.strategy === "PIVOT_TOPIC") {
        sawPivot = true;
        expect(covered.reason).toContain(
          "how they handle production incidents",
        );
      }
    }
    expect(sawPivot).toBe(true);
  });

  it("tilts toward the twist as pushback rises", () => {
    const twistShare = (pushback: number) => {
      let twists = 0;
      let curveballs = 0;
      for (let turn = 0; turn < 80; turn++) {
        const outcome = decideInterviewAction(makeAnalysis(), {
          ...seededContext({
            unpredictability: 10,
            pushback,
            uncoveredCompetency: "a probe",
          }),
          seed: { sessionId: "bias", turnIndex: turn },
        });
        if (outcome.strategy === "HYPOTHETICAL_TWIST") {
          twists += 1;
          curveballs += 1;
        } else if (outcome.strategy === "PIVOT_TOPIC") {
          curveballs += 1;
        }
      }
      return curveballs === 0 ? 0 : twists / curveballs;
    };
    expect(twistShare(9)).toBeGreaterThan(twistShare(1));
  });
});
