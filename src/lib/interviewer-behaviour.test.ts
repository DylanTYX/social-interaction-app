import { describe, expect, it } from "vitest";

import { PRESET_PERSONAS } from "@/lib/persona-engine";
import {
  describeMoves,
  personaSignature,
  summariseMoves,
} from "./interviewer-behaviour";

const neutral = {
  strictness: 5,
  warmth: 5,
  pace: 5,
  pushback: 5,
  probingDepth: 5,
  unpredictability: 5,
} as const;

describe("personaSignature", () => {
  it("says a middling interviewer is typical instead of inventing traits", () => {
    expect(personaSignature({ ...neutral })).toEqual([
      "A typical interviewer: nothing about their style is extreme",
    ]);
    expect(
      personaSignature({ ...neutral, warmth: 7, pushback: 4 }),
    ).toHaveLength(1);
  });

  it("names the dials furthest from the middle, high and low ends alike", () => {
    expect(personaSignature({ ...neutral, pushback: 9, warmth: 2 })).toEqual([
      "Challenges your claims and asks for the evidence",
      "Formal: no small talk, straight to the question",
    ]);
  });

  it("never claims warmth means praise", () => {
    const [line] = personaSignature({ ...neutral, warmth: 10 });
    expect(line).toContain("never says whether an answer was good");
  });

  it("caps the list so a card stays readable", () => {
    const extreme = {
      strictness: 10,
      warmth: 1,
      pace: 10,
      pushback: 10,
      probingDepth: 10,
      unpredictability: 10,
    } as const;
    expect(personaSignature(extreme)).toHaveLength(3);
  });

  it("gives every preset a signature no other preset shares", () => {
    const signatures = Object.values(PRESET_PERSONAS).map((p) =>
      personaSignature(p).join(" | "),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
    for (const s of signatures) expect(s).not.toContain("typical interviewer");
  });
});

describe("summariseMoves", () => {
  it("counts each move, most frequent first, and skips unknown or missing rows", () => {
    const moves = summariseMoves([
      "DRILL_SPECIFICITY",
      "PIVOT_TOPIC",
      "DRILL_SPECIFICITY",
      null,
      "SOMETHING_OLD",
      "DRILL_SPECIFICITY",
      "PIVOT_TOPIC",
      "HYPOTHETICAL_TWIST",
    ]);
    expect(moves.map((m) => [m.strategy, m.count])).toEqual([
      ["DRILL_SPECIFICITY", 3],
      ["PIVOT_TOPIC", 2],
      ["HYPOTHETICAL_TWIST", 1],
    ]);
  });

  it("is empty for a round with no scored turns", () => {
    expect(summariseMoves([])).toEqual([]);
    expect(describeMoves([])).toBeNull();
  });
});

describe("describeMoves", () => {
  it("reads as one sentence", () => {
    const sentence = describeMoves(
      summariseMoves([
        "DRILL_SPECIFICITY",
        "DRILL_SPECIFICITY",
        "DRILL_SPECIFICITY",
        "PIVOT_TOPIC",
        "PIVOT_TOPIC",
        "HYPOTHETICAL_TWIST",
      ]),
    );
    expect(sentence).toBe(
      "Pushed for specifics 3 times, changed topic twice and posed a what-if once.",
    );
  });
});
