/**
 * Any persona a user can build must still produce a coherent interviewer.
 *
 * The six presets are hand-checked; the other 999,994 combinations are not, and
 * a user creating their own persona — or randomising one — reaches them. Each
 * dial now writes a countable directive into the prompt, so the risk is no
 * longer a missing adjective but arithmetic that contradicts itself: a pace
 * budget too small to hold the acknowledgement warmth asks for, an instruction
 * that fights the private notes, a NaN reaching the model as text.
 *
 * These tests sweep the space rather than sampling opinions about it.
 */

import { describe, expect, it } from "vitest";

import {
  acknowledgementWords,
  generatePersonaPrompt,
  paceWordBudget,
  type PersonaConfig,
} from "./persona-engine";

const BASE: PersonaConfig = {
  name: "Test Person",
  nationality: "Singaporean",
  voiceGender: "unspecified",
  industry: "Software",
  seniority: "Engineering Manager",
  communicationStyle: "direct",
  strictness: 5,
  warmth: 5,
  pace: 5,
  pushback: 5,
  probingDepth: 5,
  unpredictability: 5,
  questioningStyle: "conversational",
  yearsExperience: 10,
  personalityTraits: [],
  boundaries: [],
  interestAreas: [],
};

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** A deterministic PRNG, so a failing case can be reproduced from the seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("a persona built from arbitrary dials", () => {
  it("never leaks a broken number into the prompt", () => {
    const random = mulberry32(20260918);
    const pick = () => Math.ceil(random() * 10);

    for (let i = 0; i < 2000; i += 1) {
      const persona: PersonaConfig = {
        ...BASE,
        strictness: pick() as never,
        warmth: pick() as never,
        pace: pick() as never,
        pushback: pick() as never,
        probingDepth: pick() as never,
        unpredictability: pick() as never,
      };
      const prompt = generatePersonaPrompt(persona);

      expect(prompt).not.toMatch(/NaN|undefined|Infinity|\[object/);
      // Each dial writes exactly one line — a duplicate would mean two
      // instructions on the same subject, which is how prompts start fighting.
      expect(prompt.match(/^Standards:/gm)).toHaveLength(1);
      expect(prompt.match(/^Probing depth:/gm)).toHaveLength(1);
      expect(prompt.match(/^Pace:/gm)).toHaveLength(1);
      expect(prompt.match(/^Pushback:/gm)).toHaveLength(1);
    }
  });

  it("survives values outside 1-10 and values that are not numbers", () => {
    const wild = [0, -4, 11, 99, 5.5, Number.NaN, Number.POSITIVE_INFINITY];
    for (const value of wild) {
      const prompt = generatePersonaPrompt({
        ...BASE,
        strictness: value as never,
        warmth: value as never,
        pace: value as never,
        pushback: value as never,
        probingDepth: value as never,
        unpredictability: value as never,
      });
      expect(prompt, `dials at ${value}`).not.toMatch(/NaN|undefined|Infinity/);
      expect(prompt).toContain("Standards:");
    }
  });

  it("always leaves room to ask the question after acknowledging", () => {
    // The tightest combination in the whole space is the fastest pace against
    // the warmest greeting: the budget shrinks as the acknowledgement grows.
    // If those ever cross, the interviewer is told to spend its whole allowance
    // on hello.
    let worst = Number.POSITIVE_INFINITY;
    for (const pace of VALUES) {
      for (const warmth of VALUES) {
        worst = Math.min(worst, paceWordBudget(pace) - acknowledgementWords(warmth));
      }
    }
    expect(worst).toBeGreaterThanOrEqual(15);
  });

  it("lets the private notes override the interviewer's own inclination", () => {
    // Probing depth tells the interviewer to stay on an answer. The decision
    // engine sometimes tells it to pivot away. Without this clause the two are
    // a flat contradiction, and the measured consequence was that the pivot
    // never happened — see docs/PERSONA-EVAL.md.
    for (const probingDepth of VALUES) {
      const prompt = generatePersonaPrompt({ ...BASE, probingDepth });
      expect(prompt, `probingDepth ${probingDepth}`).toContain(
        "if your private notes tell you to change subject, change subject",
      );
    }
  });
});
