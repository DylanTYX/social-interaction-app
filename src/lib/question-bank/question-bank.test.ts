import { describe, expect, it } from "vitest";

import {
  DRILL_CATEGORIES,
  DRILL_GROUPS,
  DRILL_QUESTIONS,
  exampleQuestionForRoundType,
  getCategoryMeta,
  getQuestionsForCategory,
} from "@/lib/question-bank";
import { ROUND_TYPES } from "@/lib/interview-rounds";

/**
 * The bank is data, so these are data invariants rather than behaviour tests.
 * They exist because the failure modes are silent: a topic with four questions
 * repeats within a session, a duplicated id makes `pickRandom`'s
 * do-not-repeat guard compare the wrong things, and a category pointing at a
 * round type that no longer exists sends the coach the wrong rubric with
 * nothing on screen to show it.
 */

const MIN_QUESTIONS_PER_TOPIC = 20;

describe("DRILL_CATEGORIES", () => {
  it("gives every topic a round type that actually exists", () => {
    // The whole point of `roundType` being a separate field. If it drifts, the
    // route's `isRoundType` rejects it and the coach silently falls back to the
    // behavioural STAR rubric.
    for (const category of DRILL_CATEGORIES) {
      expect(ROUND_TYPES, category.id).toContain(category.roundType);
    }
  });

  it("puts every topic in a declared group", () => {
    const groups = DRILL_GROUPS.map((group) => group.id);
    for (const category of DRILL_CATEGORIES) {
      expect(groups, category.id).toContain(category.group);
    }
  });

  it("has no duplicate topic ids or labels", () => {
    const ids = DRILL_CATEGORIES.map((c) => c.id);
    const labels = DRILL_CATEGORIES.map((c) => c.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("fills every group", () => {
    // A heading with nothing under it renders as a stray label.
    for (const group of DRILL_GROUPS) {
      expect(
        DRILL_CATEGORIES.filter((c) => c.group === group.id).length,
        group.id,
      ).toBeGreaterThan(0);
    }
  });
});

describe("DRILL_QUESTIONS", () => {
  it.each(DRILL_CATEGORIES.map((c) => c.id))(
    "gives %s enough questions to drill against",
    (categoryId) => {
      expect(getQuestionsForCategory(categoryId).length).toBeGreaterThanOrEqual(
        MIN_QUESTIONS_PER_TOPIC,
      );
    },
  );

  it("has no duplicate ids", () => {
    const ids = DRILL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate prompts", () => {
    // Two topics reaching for the same question means one of them is wrong
    // about what it covers.
    const prompts = DRILL_QUESTIONS.map((q) => q.prompt.toLowerCase().trim());
    const seen = new Set<string>();
    const duplicates = prompts.filter((p) => !seen.has(p) && !seen.add(p));
    expect(duplicates).toEqual([]);
  });

  it("declares a category that exists for every question", () => {
    const ids = new Set(DRILL_CATEGORIES.map((c) => c.id));
    for (const question of DRILL_QUESTIONS) {
      expect(ids.has(question.category), question.id).toBe(true);
    }
  });

  it("asks every question as something you could say out loud", () => {
    // The bank is answered by speaking. A prompt that says "implement" or
    // "write the function" cannot be, and there is deliberately no code editor
    // on the drills page — see docs/DRILLS.md.
    for (const question of DRILL_QUESTIONS) {
      expect(question.prompt, question.id).not.toMatch(
        /\b(implement|write the (function|code)|code up)\b/i,
      );
      expect(question.prompt.trim().length, question.id).toBeGreaterThan(15);
    }
  });
});

describe("lookups", () => {
  it("returns a real example question for every round type", () => {
    // Mirrors the assertion in round-types.test.ts. The setup wizard renders
    // one of these under each round card.
    for (const type of ROUND_TYPES) {
      expect(
        exampleQuestionForRoundType(type),
        `no example for ${type}`,
      ).toBeTruthy();
    }
  });

  it("resolves every category id to its own metadata", () => {
    for (const category of DRILL_CATEGORIES) {
      expect(getCategoryMeta(category.id).id).toBe(category.id);
    }
  });

  it("returns the whole bank for 'all'", () => {
    expect(getQuestionsForCategory("all")).toHaveLength(DRILL_QUESTIONS.length);
  });
});
