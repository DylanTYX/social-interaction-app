import { describe, expect, it } from "vitest";

import {
  ROUND_TYPES,
  applyRoundType,
  type InterviewRoundConfig,
} from "@/lib/interview-rounds";
import {
  isTechnicalRound,
  ROUND_TYPE_SPECS,
  rubricCriteria,
  supportsCodeEditor,
} from "@/lib/round-types";
import { exampleQuestionForRoundType } from "@/lib/question-bank";
import { TILE_COLOR_NAMES, tileColorForKey } from "@/lib/tile-colors";

describe("the round-type registry", () => {
  it("describes every round type completely", () => {
    // The guard that would have caught `hr`. It was added as a round type with
    // a label, a rubric and a playbook, but no default duration and no default
    // focus — because nothing required a type to be fully described in one
    // place. An incomplete entry is now a type error; this covers the values
    // TypeScript cannot check.
    for (const type of ROUND_TYPES) {
      const spec = ROUND_TYPE_SPECS[type];
      expect(spec, type).toBeDefined();
      expect(spec.label.length, type).toBeGreaterThan(0);
      expect(spec.rubric.length, type).toBeGreaterThan(0);
      expect(spec.playbookId.length, type).toBeGreaterThan(0);
      expect(spec.tags.length, type).toBeGreaterThan(0);
      expect(spec.defaults.focus.length, type).toBeGreaterThan(0);
      expect(spec.defaults.durationMinutes, type).toBeGreaterThanOrEqual(5);
      expect(spec.defaults.durationMinutes, type).toBeLessThanOrEqual(90);
    }
  });

  it("gives a code-capable type a default language, and others none", () => {
    for (const type of ROUND_TYPES) {
      const spec = ROUND_TYPE_SPECS[type];
      if (spec.supports.codeEditor) {
        expect(spec.defaults.language, type).toBeDefined();
      } else {
        expect(spec.defaults.language, type).toBeUndefined();
      }
    }
  });

  it("splits technical from behavioural exactly as the old predicates did", () => {
    // Four separate implementations of this question existed — a Set in the
    // decision engine, two || chains, and a switch. They agreed; nothing made
    // them agree. This pins the answer they all gave.
    expect(isTechnicalRound("technical_swe")).toBe(true);
    expect(isTechnicalRound("system_design")).toBe(true);
    expect(isTechnicalRound("cs_fundamentals")).toBe(true);
    expect(isTechnicalRound("behavioral")).toBe(false);
    expect(isTechnicalRound("screening")).toBe(false);
    expect(isTechnicalRound("hr")).toBe(false);
    expect(isTechnicalRound(undefined)).toBe(false);
  });

  it("offers a code editor to exactly one round type", () => {
    const codeTypes = ROUND_TYPES.filter((type) => supportsCodeEditor(type));
    expect(codeTypes).toEqual(["technical_swe"]);
  });
});

describe("applyRoundType", () => {
  const base: InterviewRoundConfig = {
    id: "r1",
    title: "Round 1",
    type: "behavioral",
    durationMinutes: ROUND_TYPE_SPECS.behavioral.defaults.durationMinutes,
    practiceMode: "text",
    focus: ROUND_TYPE_SPECS.behavioral.defaults.focus,
  };

  it("re-applies the new type's defaults when nothing was edited", () => {
    // Changing the type used to patch the type alone, so a round switched to
    // System design kept 15 minutes and a generic focus string.
    const next = applyRoundType(base, "system_design");
    expect(next.type).toBe("system_design");
    expect(next.durationMinutes).toBe(30);
    expect(next.focus).toBe("Requirements, architecture, and tradeoffs.");
  });

  it("never overwrites a duration the user chose", () => {
    const edited = { ...base, durationMinutes: 45 };
    expect(applyRoundType(edited, "system_design").durationMinutes).toBe(45);
  });

  it("never overwrites a focus the user wrote", () => {
    const edited = { ...base, focus: "Ask me about the payments migration." };
    expect(applyRoundType(edited, "technical_swe").focus).toBe(
      "Ask me about the payments migration.",
    );
  });

  it("replaces the generic placeholder focus a blank round starts with", () => {
    const blank = { ...base, focus: "What you want this round to focus on." };
    expect(applyRoundType(blank, "cs_fundamentals").focus).toBe(
      ROUND_TYPE_SPECS.cs_fundamentals.defaults.focus,
    );
  });

  it("clears answerFormat, so a code override cannot follow the round", () => {
    const coding = {
      ...base,
      type: "technical_swe" as const,
      answerFormat: "code" as const,
    };
    expect(applyRoundType(coding, "behavioral").answerFormat).toBeUndefined();
  });
});

describe("drill coverage", () => {
  it("has questions for every round type", async () => {
    // `hr` shipped with no drill category and no questions — the same gap the
    // registry exists to make visible.
    const { DRILL_CATEGORIES, DRILL_QUESTIONS } =
      await import("@/lib/question-bank");

    for (const type of ROUND_TYPES) {
      const categories = DRILL_CATEGORIES.filter((c) => c.roundType === type);
      expect(
        categories.length,
        `no drill category for ${type}`,
      ).toBeGreaterThan(0);

      const questions = DRILL_QUESTIONS.filter((q) =>
        categories.some((c) => c.id === q.category),
      );
      expect(
        questions.length,
        `no drill questions for ${type}`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("round type identity", () => {
  it("gives every round type an icon and an accent", () => {
    // The wizard renders `spec.icon` and indexes `TILE_COLORS[spec.accent]`
    // directly, so a missing entry is a crash, not a blank card.
    for (const type of ROUND_TYPES) {
      const spec = ROUND_TYPE_SPECS[type];
      expect(spec.icon, `no icon for ${type}`).toBeTruthy();
      expect(TILE_COLOR_NAMES, `bad accent for ${type}`).toContain(spec.accent);
    }
  });

  it("splits the rubric into criteria the card can list", () => {
    for (const type of ROUND_TYPES) {
      const criteria = rubricCriteria(type);
      expect(criteria.length, `no criteria for ${type}`).toBeGreaterThan(0);
      // Chips, not a sentence — a trailing empty string from the split would
      // render an empty badge.
      expect(criteria.every((c) => c.length > 0)).toBe(true);
    }
  });

  it("returns a real example question for every round type", () => {
    for (const type of ROUND_TYPES) {
      expect(
        exampleQuestionForRoundType(type),
        `no example for ${type}`,
      ).toBeTruthy();
    }
  });

  it("keeps the example stable for a given seed and varies it across rounds", () => {
    // It renders inside a controlled form, so re-picking on every keystroke
    // would make the card flicker as you type.
    expect(exampleQuestionForRoundType("behavioral", 0)).toBe(
      exampleQuestionForRoundType("behavioral", 0),
    );
    expect(exampleQuestionForRoundType("behavioral", 0)).not.toBe(
      exampleQuestionForRoundType("behavioral", 1),
    );
  });
});

describe("tileColorForKey", () => {
  it("is stable for a name, so a persona keeps its colour when the library re-sorts", () => {
    expect(tileColorForKey("Sarah Chen")).toBe(tileColorForKey("Sarah Chen"));
    expect(TILE_COLOR_NAMES).toContain(tileColorForKey("Sarah Chen"));
  });

  it("handles an empty name rather than indexing out of range", () => {
    expect(TILE_COLOR_NAMES).toContain(tileColorForKey(""));
  });
});
