/**
 * The persona's voice in the private note. Warmth and pushback were the two
 * dials a blind judge could barely see, because they
 * only reached the part of the prompt the model reads least; these tests pin
 * what now reaches the part it follows.
 */

import { describe, expect, it } from "vitest";

import { makeAnalysis } from "@/lib/test-support/analysis";
import { deliveryLines, escalationLine, warmthBand } from "./persona-delivery";
import { buildSteeringBlock } from "./steering-block";

const note = (
  warmth: number,
  pushback: number,
  strategy: Parameters<typeof deliveryLines>[1] = "PROBE_ACTION",
  escalate = false,
) =>
  buildSteeringBlock(
    makeAnalysis({
      overallScore: 58,
      strengths: ["clear timeline"],
      gaps: ["no metrics"],
    }),
    strategy,
    "the answer was vague about ownership",
    "what they did themselves",
    6,
    escalate,
    false,
    { warmth, pushback },
  );

describe("warmthBand", () => {
  it("uses the same bands as the dial's label", () => {
    expect([1, 4, 5, 7, 8, 10].map(warmthBand)).toEqual([
      "reserved",
      "reserved",
      "neutral",
      "neutral",
      "warm",
      "warm",
    ]);
  });
});

describe("deliveryLines", () => {
  it("lets a warm interviewer be friendly without grading", () => {
    const [line] = deliveryLines({ warmth: 9, pushback: 5 }, "PROBE_ACTION");
    expect(line).toContain("friendly");
    expect(line).toContain("never say whether the answer was good");
  });

  it("tells a reserved interviewer to start with the question", () => {
    const [line] = deliveryLines({ warmth: 2, pushback: 5 }, "PROBE_ACTION");
    expect(line).toContain("No acknowledgement");
  });

  it("gives warm and reserved interviewers different notes for the same turn", () => {
    expect(note(9, 5)).not.toEqual(note(2, 5));
  });

  it("repeats the challenge rung only when pushback is high", () => {
    expect(note(5, 9)).toContain("- Challenge: Name two claims");
    expect(note(5, 7)).toContain("- Challenge: Name one claim");
    expect(note(5, 5)).not.toContain("- Challenge:");
    // Low pushback stays out of the note, so "take it at face value" can never
    // overrule a weakness-driven move such as drilling for specifics.
    expect(note(5, 1, "DRILL_SPECIFICITY")).not.toContain("face value");
  });

  it("never stacks a challenge on a curveball or a clarifying question", () => {
    expect(note(5, 9, "PIVOT_TOPIC")).not.toContain("- Challenge:");
    expect(note(5, 9, "HYPOTHETICAL_TWIST")).not.toContain("- Challenge:");
    expect(note(5, 9, "CLARIFY_SITUATION")).not.toContain("- Challenge:");
  });

  it("puts the persona's voice last, where it is read most reliably", () => {
    const lines = note(9, 9).split("\n");
    expect(lines.at(-2)).toContain("- Delivery: warm");
    expect(lines.at(-1)).toContain("- Challenge:");
  });

  it("adds nothing for an interviewer with no persona", () => {
    const plain = buildSteeringBlock(
      makeAnalysis({ overallScore: 58 }),
      "PROBE_ACTION",
      "reason",
      "focus",
      6,
      false,
      false,
    );
    expect(plain).not.toContain("Delivery");
  });
});

describe("escalationLine", () => {
  it("presses kindly when warm and bluntly when reserved or sceptical", () => {
    expect(escalationLine({ warmth: 9, pushback: 9 })).toContain("kindly");
    expect(escalationLine({ warmth: 2, pushback: 5 })).toContain(
      "say plainly what is missing",
    );
    expect(escalationLine({ warmth: 5, pushback: 9 })).toContain(
      "say plainly what is missing",
    );
    expect(escalationLine({ warmth: 5, pushback: 5 })).toBe(
      "- The answer was weak or repeated; be firmer and push for specifics.",
    );
  });

  it("reaches the note when the answer was weak", () => {
    expect(note(9, 5, "DRILL_SPECIFICITY", true)).toContain("kindly");
  });
});

describe("no persona grades the answer out loud", () => {
  it("never tells the interviewer to call an answer good", () => {
    for (const warmth of [1, 5, 10])
      for (const pushback of [1, 5, 10])
        for (const escalate of [false, true]) {
          const text = note(
            warmth,
            pushback,
            "PROBE_ACTION",
            escalate,
          ).toLowerCase();
          expect(text).not.toMatch(/praise|compliment|great answer|well done/);
        }
  });
});
