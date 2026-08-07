import { describe, expect, it } from "vitest";

import {
  generatePersonaPrompt,
  NATIONALITY_IS_BACKGROUND,
  PRESET_PERSONAS,
  type PersonaConfig,
} from "@/lib/persona-engine";
import { estimateFollowupDifficulty } from "@/lib/decision-engine";
import { makeAnalysis } from "@/lib/test-support/analysis";

/**
 * The tests that were missing.
 *
 * `generatePersonaPrompt` had **no test file at all** — three references in the
 * whole repo (definition, import, single call site) and nothing asserting that
 * two personas produce different instructions. That is the central claim of an
 * interview trainer built around configurable interviewers, and it was unpinned.
 *
 * These exist to make that claim demonstrable rather than assertable, and to
 * pin the dial thresholds, which are coarse enough to surprise someone: three
 * different strictness values collapse to the same sentence.
 */

function persona(partial: Partial<PersonaConfig> = {}): PersonaConfig {
  return {
    name: "Test Interviewer",
    nationality: "British",
    industry: "Technology",
    seniority: "Engineering Manager",
    communicationStyle: "direct",
    strictness: 5,
    warmth: 5,
    pace: 5,
    pushback: 5,
    yearsExperience: 10,
    personalityTraits: [],
    boundaries: [],
    interestAreas: [],
    ...partial,
  };
}

describe("two personas produce different instructions", () => {
  // The maximum-divergence pair in the shipped library. Sarah Chen and Lars
  // Petersen would be a poor choice — both `direct` at strictness 8, they
  // differ only in one pace sentence — so the demo uses these two.
  const yuki = PRESET_PERSONAS["yuki tanaka"];
  const isabella = PRESET_PERSONAS["isabella rodriguez"];

  it("has the contrasting pair the demo relies on", () => {
    expect(yuki, "Yuki Tanaka missing from PRESET_PERSONAS").toBeTruthy();
    expect(
      isabella,
      "Isabella Rodriguez missing from PRESET_PERSONAS",
    ).toBeTruthy();
  });

  it("differs on every one of the four behavioural dials", () => {
    // If a future edit brings their dials closer together, the demo quietly
    // stops demonstrating anything. This fails loudly instead.
    expect(yuki.strictness).not.toBe(isabella.strictness);
    expect(yuki.warmth).not.toBe(isabella.warmth);
    expect(yuki.pace).not.toBe(isabella.pace);
    expect(yuki.pushback).not.toBe(isabella.pushback);
    expect(yuki.communicationStyle).not.toBe(isabella.communicationStyle);
  });

  it("produces materially different prompts, not just a different name", () => {
    const a = generatePersonaPrompt(yuki);
    const b = generatePersonaPrompt(isabella);
    expect(a).not.toBe(b);

    // Specifically: the behavioural sentences differ, not only the biography.
    expect(a).toContain("high expectations");
    expect(b).not.toContain("high expectations");
    expect(a).toContain("Pushback: high");
    expect(b).toContain("Pushback: light");
  });
});

describe("the dial thresholds", () => {
  // Pinning these because they are coarser than they look. Anyone reading
  // "strictness 1-10" reasonably expects ten gradations; there are three.
  it.each([
    [9, "high expectations and won't tolerate mediocrity"],
    [8, "high expectations and won't tolerate mediocrity"],
    [7, "moderate standards"],
    [5, "moderate standards"],
    [4, "flexible and understanding"],
    [1, "flexible and understanding"],
  ])("strictness %i reads as %s", (strictness, expected) => {
    const prompt = generatePersonaPrompt(
      persona({ strictness: strictness as PersonaConfig["strictness"] }),
    );
    expect(prompt).toContain(expected);
  });

  it("collapses strictness 5, 6 and 7 to identical text", () => {
    // Documented rather than fixed: it means a demo comparing strictness 5 vs 7
    // would show no difference at all, and someone should know that before
    // standing in front of a room claiming otherwise.
    const five = generatePersonaPrompt(persona({ strictness: 5 }));
    const seven = generatePersonaPrompt(persona({ strictness: 7 }));
    expect(five).toBe(seven);
  });

  it.each([
    [9, "Pushback: high"],
    [6, "Pushback: moderate"],
    [4, "Pushback: light"],
    [1, "Pushback: minimal"],
  ])("pushback %i reads as %s", (pushback, expected) => {
    const prompt = generatePersonaPrompt(
      persona({ pushback: pushback as PersonaConfig["pushback"] }),
    );
    expect(prompt).toContain(expected);
  });

  it.each([
    [9, "Pace: fast and assertive"],
    [6, "Pace: brisk"],
    [4, "Pace: balanced"],
    [1, "Pace: deliberate and patient"],
  ])("pace %i reads as %s", (pace, expected) => {
    const prompt = generatePersonaPrompt(
      persona({ pace: pace as PersonaConfig["pace"] }),
    );
    expect(prompt).toContain(expected);
  });

  it("defaults a missing pace or pushback to the neutral middle", () => {
    const prompt = generatePersonaPrompt(
      persona({ pace: undefined, pushback: undefined }),
    );
    expect(prompt).toContain("Pace: balanced");
    expect(prompt).toContain("Pushback: light");
  });
});

describe("nationality is background, not behaviour", () => {
  it("carries the guard in every generated prompt", () => {
    expect(generatePersonaPrompt(persona())).toContain(
      NATIONALITY_IS_BACKGROUND,
    );
  });

  it("changes nothing behavioural when only the nationality changes", () => {
    // The claim the guard exists to support: nationality is biography. Two
    // otherwise-identical personas must differ by exactly the demonym.
    const a = generatePersonaPrompt(persona({ nationality: "Japanese" }));
    const b = generatePersonaPrompt(persona({ nationality: "Brazilian" }));

    expect(a).not.toBe(b);
    expect(a.replace("Japanese", "Brazilian")).toBe(b);
  });
});

describe("strictness and warmth reach the decision engine, not just the prompt", () => {
  // This is what makes "personas behave differently" a measurable claim rather
  // than a textual one: the dials feed arithmetic whose result is injected back
  // into the prompt as an explicit `Aim for difficulty N/10` instruction. It is
  // pure and deterministic, so it can be demonstrated on stage with no API call
  // and no chance of a non-reproducible answer.
  const analysis = makeAnalysis({ overallScore: 70 });

  it("is monotonic in strictness", () => {
    const low = estimateFollowupDifficulty(analysis, {
      personaName: "Test Interviewer",
      strictness: 1,
      warmth: 5,
    });
    const high = estimateFollowupDifficulty(analysis, {
      personaName: "Test Interviewer",
      strictness: 10,
      warmth: 5,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("is inversely monotonic in warmth", () => {
    const cold = estimateFollowupDifficulty(analysis, {
      personaName: "Test Interviewer",
      strictness: 5,
      warmth: 1,
    });
    const warm = estimateFollowupDifficulty(analysis, {
      personaName: "Test Interviewer",
      strictness: 5,
      warmth: 10,
    });
    expect(cold).toBeGreaterThan(warm);
  });

  it("separates the two demo personas on the same answer", () => {
    // The number the demo puts on screen. Same candidate answer, same round,
    // different interviewer — a different difficulty target for the follow-up.
    const yuki = PRESET_PERSONAS["yuki tanaka"];
    const isabella = PRESET_PERSONAS["isabella rodriguez"];

    const strict = estimateFollowupDifficulty(analysis, {
      personaName: "Test Interviewer",
      strictness: yuki.strictness,
      warmth: yuki.warmth,
    });
    const warm = estimateFollowupDifficulty(analysis, {
      personaName: "Test Interviewer",
      strictness: isabella.strictness,
      warmth: isabella.warmth,
    });
    expect(strict).toBeGreaterThan(warm);
  });

  it("stays inside the 1-10 band at both extremes", () => {
    const max = estimateFollowupDifficulty(analysis, {
      personaName: "Test Interviewer",
      strictness: 10,
      warmth: 1,
    });
    const min = estimateFollowupDifficulty(analysis, {
      personaName: "Test Interviewer",
      strictness: 1,
      warmth: 10,
    });
    expect(max).toBeLessThanOrEqual(10);
    expect(min).toBeGreaterThanOrEqual(1);
  });
});
