import { describe, expect, it } from "vitest";

import {
  buildCoachSystemPrompt,
  buildCoachUserPrompt,
  COACH_FALLBACK_ROUND_TYPE,
  MAX_TIPS,
  parseCoachResult,
} from "@/lib/coach-prompt";
import { COACH_RUBRICS } from "@/lib/coach-rubric";
import { ROUND_TYPES, type InterviewRoundType } from "@/lib/interview-rounds";
import { rubricCriteria } from "@/lib/round-types";

/**
 * These are the tests that would have caught the state this module replaced:
 * `rubricGuidance` had two branches for six round types, so `screening` and
 * `hr` answers were coached against the STAR rubric while being *scored*
 * against clarity/motivation/fit and motivation/values/logistics.
 *
 * Nothing here calls OpenAI. The prompt is a pure function of the round type,
 * which is the whole reason it was pulled out of the route.
 */

describe("buildCoachSystemPrompt", () => {
  it("produces a distinct prompt for every round type", () => {
    const prompts = ROUND_TYPES.map((type) => buildCoachSystemPrompt(type));

    // The failing state was 2 distinct prompts for 6 round types.
    expect(new Set(prompts).size).toBe(ROUND_TYPES.length);
  });

  it.each(ROUND_TYPES)(
    "tells the model the exact criteria the %s round is scored on",
    (type: InterviewRoundType) => {
      const prompt = buildCoachSystemPrompt(type).toLowerCase();

      // Weaker than it looks, and deliberately so: the criteria are
      // interpolated from `ROUND_TYPE_SPECS`, so this cannot fail while that
      // interpolation is in place. That is the point — it is a drift guard. If
      // someone replaces the interpolation with hand-typed prose, the coach
      // starts optimising for a rubric the analyzer no longer scores against,
      // and this fails.
      //
      // Whether the *guidance* actually covers those criteria is a question
      // about prose, which no substring assertion can answer. The structural
      // half of it is in the COACH_RUBRICS block below.
      for (const criterion of rubricCriteria(type)) {
        expect(prompt).toContain(criterion.toLowerCase());
      }
    },
  );

  it.each(ROUND_TYPES)(
    "carries the %s round's own shape and failure modes",
    (type: InterviewRoundType) => {
      const prompt = buildCoachSystemPrompt(type);
      const rubric = COACH_RUBRICS[type];

      expect(prompt).toContain(rubric.shape);
      expect(prompt).toContain(rubric.exemplar);
      for (const signal of rubric.signals) {
        expect(prompt).toContain(signal);
      }
      for (const mode of rubric.failureModes) {
        expect(prompt).toContain(mode);
      }
    },
  );

  it("falls back to the behavioral STAR rubric for an unknown round type", () => {
    const prompt = buildCoachSystemPrompt(undefined);

    // The route's own test asserts this too — an unvalidated `roundType` from
    // the client must land somewhere defined rather than changing the rubric.
    expect(prompt).toContain("STAR");
    expect(prompt).toBe(buildCoachSystemPrompt(COACH_FALLBACK_ROUND_TYPE));
  });

  it("forbids inventing specifics in the rewrite in checkable terms", () => {
    // The clause this replaced was "do not fabricate major new achievements",
    // which no harness can test because "major" is undefined. The replacement
    // is a set comparison over quantities, which `run-coach-eval.ts` performs.
    const prompt = buildCoachSystemPrompt("behavioral");

    expect(prompt).toMatch(/every number, name, date and outcome/i);
    expect(prompt).toMatch(/no number/i);
  });
});

describe("COACH_RUBRICS", () => {
  /**
   * The `Record<InterviewRoundType, …>` makes a *missing* round type a compile
   * error. It does not make an *empty* one — `{ shape: "", signals: [], … }`
   * type-checks fine and would silently reproduce the two-branch behaviour this
   * module was written to end. These are the assertions the type cannot make.
   */
  it.each(ROUND_TYPES)("gives %s substantive guidance", (type) => {
    const rubric = COACH_RUBRICS[type];

    expect(rubric.shape.length).toBeGreaterThan(40);
    expect(rubric.exemplar.length).toBeGreaterThan(40);

    // At least one signal and one failure mode per criterion being scored, so
    // guidance cannot be thinner than the rubric it is meant to cover.
    const criteria = rubricCriteria(type).length;
    expect(rubric.signals.length).toBeGreaterThanOrEqual(
      Math.min(criteria, 4),
    );
    expect(rubric.failureModes.length).toBeGreaterThanOrEqual(
      Math.min(criteria, 4),
    );

    for (const line of [...rubric.signals, ...rubric.failureModes]) {
      expect(line.trim().length).toBeGreaterThan(20);
    }
  });

  it("does not reuse the same guidance for two round types", () => {
    // `screening`, `behavioral` and `hr` shared a single hardcoded STAR
    // sentence before this existed, and the three technical types shared
    // another. Both are now distinct by construction; this keeps them so.
    const shapes = ROUND_TYPES.map((type) => COACH_RUBRICS[type].shape);

    expect(new Set(shapes).size).toBe(ROUND_TYPES.length);
  });
});

describe("buildCoachUserPrompt", () => {
  it("keeps the question and the answer in labelled sections", () => {
    const prompt = buildCoachUserPrompt("Why this role?", "Because I like it.");

    expect(prompt).toContain("QUESTION:\nWhy this role?");
    expect(prompt).toContain("CANDIDATE ANSWER:\nBecause I like it.");
  });
});

describe("parseCoachResult", () => {
  const full = {
    modelAnswer: "A strong answer.",
    rewrite: "Your answer, tightened.",
    tips: ["Add a number", "Name the result"],
  };

  it("passes a well-formed payload through untouched", () => {
    const parsed = parseCoachResult(JSON.stringify(full));

    expect(parsed.result).toEqual(full);
    expect(parsed.omittedFields).toEqual([]);
    expect(parsed.repaired).toBe(false);
    expect(parsed.contractWarnings).toEqual([]);
  });

  it("records what the model omitted before the defaults hide it", () => {
    // Without this the finished object is complete by construction and a
    // completeness metric measures nothing. Same argument as the analyzer's
    // `omittedFields`.
    const parsed = parseCoachResult(JSON.stringify({ rewrite: "Tightened." }));

    expect(parsed.omittedFields).toContain("modelAnswer");
    expect(parsed.omittedFields).toContain("tips");
    expect(parsed.omittedFields).not.toContain("rewrite");
    expect(parsed.result.modelAnswer).toBe("");
  });

  it("treats a whitespace-only field as omitted, not as present", () => {
    const parsed = parseCoachResult(
      JSON.stringify({ ...full, modelAnswer: "   " }),
    );

    expect(parsed.omittedFields).toContain("modelAnswer");
  });

  it("drops non-string tips and caps the rest", () => {
    const parsed = parseCoachResult(
      JSON.stringify({
        ...full,
        tips: ["one", 2, "three", null, "four", "five", "six"],
      }),
    );

    expect(parsed.result.tips).toEqual(["one", "three", "four", "five"]);
    expect(parsed.result.tips).toHaveLength(MAX_TIPS);
  });

  it("flags a tip count outside the range the prompt asked for", () => {
    const parsed = parseCoachResult(
      JSON.stringify({ ...full, tips: ["only one"] }),
    );

    expect(parsed.contractWarnings.join(" ")).toMatch(/tips count 1/);
  });

  it("flags tips that run past the length the prompt asked for", () => {
    const parsed = parseCoachResult(
      JSON.stringify({
        ...full,
        tips: [
          "this tip runs on well past the twelve word ceiling the prompt asked it to respect",
          "short one",
        ],
      }),
    );

    expect(parsed.contractWarnings.join(" ")).toMatch(/1 tip\(s\) over/);
  });

  it("recovers a repaired payload and says that it repaired it", () => {
    // `jsonrepair` is a dependency precisely because this happens; until now
    // nothing counted how often.
    const parsed = parseCoachResult(
      '{"modelAnswer": "A.", "rewrite": "B.", "tips": ["one", "two",]}',
    );

    expect(parsed.repaired).toBe(true);
    expect(parsed.result.rewrite).toBe("B.");
  });

  it("unwraps a fenced code block", () => {
    const parsed = parseCoachResult(
      "```json\n" + JSON.stringify(full) + "\n```",
    );

    expect(parsed.result).toEqual(full);
  });
});
