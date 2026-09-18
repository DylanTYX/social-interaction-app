/**
 * The steering block is the only place a persona's *numbers* reach the model,
 * so what it does and does not say is load-bearing in two directions: it must
 * carry the decision, and it must not leak the evaluation.
 *
 * It had no test while it lived inside the chat route. See
 * `docs/PERSONA-EVAL.md` for what it is measured to change.
 */

import { describe, expect, it } from "vitest";

import { makeAnalysis } from "@/lib/test-support/analysis";
import { buildSteeringBlock, STRATEGY_LABEL } from "./steering-block";

const build = (
  overrides: Partial<{
    difficulty: number;
    escalate: boolean;
    slowDown: boolean;
  }> = {},
) =>
  buildSteeringBlock(
    makeAnalysis({
      overallScore: 58,
      strengths: ["named the stakeholders"],
      gaps: ["no metrics"],
    }),
    "PROBE_ACTION",
    "the answer was vague about ownership",
    "what was cut, and who decided",
    overrides.difficulty ?? 6,
    overrides.escalate ?? false,
    overrides.slowDown ?? false,
  );

describe("buildSteeringBlock", () => {
  it("carries the difficulty the persona's dials asked for", () => {
    expect(build({ difficulty: 9 })).toContain("Aim for difficulty 9/10.");
    expect(build({ difficulty: 3 })).toContain("Aim for difficulty 3/10.");
  });

  it("marks the note private, so it is never read aloud", () => {
    expect(build()).toContain("never read out");
  });

  it("names the strength but forbids praising it", () => {
    const block = build();
    expect(block).toContain("named the stakeholders");
    expect(block).toContain("Do not praise it out loud");
  });

  it("presses on escalate and deepens on slow-down, never both", () => {
    expect(build({ escalate: true })).toContain("push for specifics");
    expect(build({ slowDown: true })).toContain("one level deeper");
    // Escalate wins: a weak answer must not also be told it was strong.
    const both = build({ escalate: true, slowDown: true });
    expect(both).toContain("push for specifics");
    expect(both).not.toContain("one level deeper");
  });

  it("renames ACKNOWLEDGE_STRENGTH so the model does not acknowledge out loud", () => {
    const block = buildSteeringBlock(
      makeAnalysis(),
      "ACKNOWLEDGE_STRENGTH",
      "the answer held up",
      "the tradeoff they skipped",
      6,
      false,
      false,
    );
    expect(STRATEGY_LABEL.ACKNOWLEDGE_STRENGTH).toBe("RAISE_THE_BAR");
    expect(block).toContain("RAISE_THE_BAR");
    expect(block).not.toContain("ACKNOWLEDGE_STRENGTH");
  });

  it("omits the strength and gap lines when the analysis has neither", () => {
    const block = buildSteeringBlock(
      makeAnalysis({ strengths: [], gaps: [] }),
      "PROBE_ACTION",
      "reason",
      "focus",
      5,
      false,
      false,
    );
    expect(block).not.toContain("What held up");
    expect(block).not.toContain("The main gap");
  });
});
