import { describe, expect, it } from "vitest";

import { analyzeDelivery } from "@/lib/speech-metrics";

const fillers = (text: string) => analyzeDelivery(text).fillerCount;

describe("filler detection", () => {
  it("counts unambiguous hesitations", () => {
    expect(fillers("um so uh I think, you know, I mean it worked")).toBeGreaterThanOrEqual(4);
  });

  it("does not count 'like' used as a comparison", () => {
    // The rule the module documents: ambiguous words are only fillers next to
    // a real hesitation. This used to be counted and inflated every technical
    // answer.
    expect(fillers("a linked list works like a queue here")).toBe(0);
  });

  it("counts 'like' when it follows a hesitation", () => {
    expect(fillers("it was um, like, complicated")).toBeGreaterThan(0);
  });

  it("does not match a hesitation inside another word", () => {
    // `\bum\b` matters: without it "drum like" matched as "um like".
    expect(fillers("the drum like a metronome")).toBe(0);
    expect(fillers("the album basically works")).toBe(0);
  });

  it("does not count emphasis words at all", () => {
    expect(fillers("I actually shipped it and literally doubled throughput")).toBe(0);
  });
});
