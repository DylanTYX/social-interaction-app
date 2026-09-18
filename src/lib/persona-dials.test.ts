/**
 * The labels next to each slider must mean what the interviewer is told.
 *
 * `persona-dials.ts` copies its thresholds from `persona-engine` and
 * `decision-engine`. Copies drift, and a drifted copy is worse than no label
 * at all: it tells a user the interviewer changed when it did not. These tests
 * re-derive each band from the real consumer and compare.
 *
 * The probing and curveball checks import the eval's own measurements rather
 * than re-implementing them — a second copy of the measurement could drift in
 * exactly the way this file exists to catch.
 */

import { describe, expect, it } from "vitest";

import { probeRate, neutralPersona, DIAL_VALUES } from "@/eval/persona-sweeps";
import { decideInterviewAction } from "@/lib/decision-engine";
import { generatePersonaPrompt, type PersonaConfig } from "@/lib/persona-engine";
import { makeAnalysis } from "@/lib/test-support/analysis";

import {
  bandRange,
  describeDial,
  dialBands,
  type PersonaDialKey,
} from "./persona-dials";

/** Values 1-10 grouped by the label they are given, as "1,2,3" keys. */
function partitionByLabel(dial: PersonaDialKey): string[] {
  const groups = new Map<string, number[]>();
  for (const value of DIAL_VALUES) {
    const { label } = describeDial(dial, value);
    groups.set(label, [...(groups.get(label) ?? []), value]);
  }
  return [...groups.values()].map((values) => values.join(","));
}

/** Values 1-10 grouped by the sentence the interviewer is actually given. */
function partitionByPrompt(dial: PersonaDialKey, extract: RegExp): string[] {
  const groups = new Map<string, number[]>();
  for (const value of DIAL_VALUES) {
    const persona = { ...neutralPersona(), [dial]: value } as PersonaConfig;
    const match = generatePersonaPrompt(persona).match(extract);
    const key = match?.[1] ?? match?.[0] ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return [...groups.values()].map((values) => values.join(","));
}

describe("labels match the interviewer's own instructions", () => {
  const cases: [PersonaDialKey, RegExp][] = [
    [
      "strictness",
      /you (?:have high expectations and won't tolerate mediocrity|have moderate standards|are flexible and understanding)/,
    ],
    [
      "warmth",
      /(warm and encouraging|professional and neutral|reserved and formal)\./,
    ],
    ["pace", /Pace: ([a-z]+(?: and [a-z]+)?) \(/],
    ["pushback", /Pushback: ([a-z]+) \(/],
  ];

  for (const [dial, pattern] of cases) {
    it(`${dial}: every label covers exactly one prompt band`, () => {
      expect(partitionByLabel(dial)).toEqual(partitionByPrompt(dial, pattern));
    });
  }
});

describe("labels the prompt does not carry are still tied to behaviour", () => {
  it("probing depth labels rise with the share of claims probed", () => {
    const bands = dialBands("probingDepth");
    const rates = bands.map((band) => probeRate(band.from as never));
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    }
    // The top band claims every claim is probed, so it had better be.
    expect(rates[rates.length - 1]).toBe(1);
  });

  it("unpredictability labels rise with the share of turns that curveball", () => {
    const measure = (value: number) => {
      let fired = 0;
      for (let turn = 0; turn < 200; turn += 1) {
        const outcome = decideInterviewAction(makeAnalysis(), {
          personaName: "label-check",
          questioningStyle: "conversational",
          unpredictability: value,
          seed: { sessionId: "label-check", turnIndex: turn },
          uncoveredCompetency: "how they handle production incidents",
        });
        if (outcome.strategy === "PIVOT_TOPIC" || outcome.strategy === "HYPOTHETICAL_TWIST") {
          fired += 1;
        }
      }
      return fired / 200;
    };

    const rates = dialBands("unpredictability").map((band) => measure(band.from));
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    }
    // "Never" must mean never, not "hardly ever".
    expect(rates[0]).toBe(0);
  });
});

describe("band ranges", () => {
  it("say how far a slider moves before anything changes", () => {
    expect(bandRange("strictness", 9)).toBe("8-10");
    expect(bandRange("strictness", 2)).toBe("1-4");
    expect(bandRange("pushback", 8)).toBe("8-10");
    expect(bandRange("pace", 5)).toBe("4-5");
  });

  it("covers 1 to 10 with no gap and no overlap, for every dial", () => {
    const dials: PersonaDialKey[] = [
      "strictness",
      "warmth",
      "pace",
      "pushback",
      "probingDepth",
      "unpredictability",
    ];
    for (const dial of dials) {
      const covered = DIAL_VALUES.flatMap((value) => {
        const [lo, hi] = bandRange(dial, value).split("-").map(Number);
        return [lo, Number.isFinite(hi) ? hi : lo];
      });
      expect(Math.min(...covered), dial).toBe(1);
      expect(Math.max(...covered), dial).toBe(10);
    }
  });
});
