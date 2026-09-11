import { describe, expect, it } from "vitest";

import { describeDifficulty, difficultyBias } from "@/lib/interview-difficulty";

/**
 * Whether a score can be compared across interviewers.
 *
 * The rubric is persona-blind — `analyzeResponse` never sees the persona — so
 * nobody scores better by picking a kinder one. But the *questions* are not:
 * `estimateFollowupDifficulty` folds `(strictness - warmth) / 4` into the
 * difficulty it asks for, and easier questions get better answers. Nothing in
 * the product said so; the analytics page pooled them into one trend line.
 */

describe("difficultyBias", () => {
  it("matches the expression the interviewer prompt actually uses", () => {
    // Aisyah Rahman: strictness 9, warmth 4.
    expect(difficultyBias(9, 4)).toBe(1.25);
    // Isabella: strictness 6, warmth 9.
    expect(difficultyBias(6, 9)).toBe(-0.75);
  });

  it("treats missing dials as neutral rather than zero", () => {
    expect(difficultyBias(undefined, undefined)).toBe(0);
  });
});

describe("describeDifficulty", () => {
  it("calls a strict, cool interviewer demanding", () => {
    expect(describeDifficulty(9, 4).band).toBe("demanding");
  });

  it("calls a warm, lenient interviewer supportive", () => {
    expect(describeDifficulty(4, 9).band).toBe("gentle");
  });

  it("treats a small difference as balanced", () => {
    // A quarter-point of bias is well inside noise; the middle band is wide on
    // purpose so the label does not flip on a one-point dial change.
    expect(describeDifficulty(6, 5).band).toBe("balanced");
    expect(describeDifficulty(5, 5).band).toBe("balanced");
  });

  it("always gives the user a sentence they can act on", () => {
    for (const [strictness, warmth] of [
      [9, 4],
      [5, 5],
      [4, 9],
    ]) {
      const context = describeDifficulty(strictness, warmth);
      expect(context.note.length).toBeGreaterThan(20);
      expect(context.label.length).toBeGreaterThan(0);
    }
  });
});
