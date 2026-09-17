import { describe, expect, it } from "vitest";

import {
  analyzeDelivery,
  LONG_PAUSE_SECONDS,
  FILLER_BANDS,
  FILLER_WORDS,
  fillerLabelFor,
  PACE_BANDS,
  paceFromWpm,
} from "@/lib/speech-metrics";

const fillers = (text: string) => analyzeDelivery(text).fillerCount;

describe("filler detection", () => {
  it("counts unambiguous hesitations", () => {
    expect(
      fillers("um so uh I think, you know, I mean it worked"),
    ).toBeGreaterThanOrEqual(4);
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
    expect(
      fillers("I actually shipped it and literally doubled throughput"),
    ).toBe(0);
  });
});

// Tips & guides prints these constants as the rules. If a band moved without
// the constant, the page would teach a threshold the readout does not use.
describe("published thresholds", () => {
  it("match the pace bands the readout applies", () => {
    expect(paceFromWpm(PACE_BANDS.measured - 1)).toBe("slow");
    expect(paceFromWpm(PACE_BANDS.measured)).toBe("measured");
    expect(paceFromWpm(PACE_BANDS.conversational)).toBe("conversational");
    expect(paceFromWpm(PACE_BANDS.fastAbove)).toBe("conversational");
    expect(paceFromWpm(PACE_BANDS.fastAbove + 1)).toBe("fast");
  });

  it("match the filler bands the readout applies", () => {
    expect(fillerLabelFor(FILLER_BANDS.cleanBelow - 0.1)).toBe("clean");
    expect(fillerLabelFor(FILLER_BANDS.cleanBelow)).toBe("occasional");
    expect(fillerLabelFor(FILLER_BANDS.frequentAbove)).toBe("occasional");
    expect(fillerLabelFor(FILLER_BANDS.frequentAbove + 0.1)).toBe("frequent");
  });

  it("lists every counted filler, marking the ones that need a hesitation", () => {
    const needsHesitation = FILLER_WORDS.filter((w) => w.onlyBesideHesitation);
    expect(needsHesitation.map((w) => w.label)).toEqual(["like", "basically"]);
    for (const { label, onlyBesideHesitation } of FILLER_WORDS) {
      const alone = fillers(`and then ${label} it worked`);
      expect(alone > 0).toBe(!onlyBesideHesitation);
    }
  });
});

describe("pauses", () => {
  const phrase = (offsetSeconds: number, durationSeconds = 1) => ({
    text: "some words here",
    offsetSeconds,
    durationSeconds,
  });

  it("does not count an ordinary breath between sentences", () => {
    // 1.5s used to count, which reported a normal way of speaking as an event.
    const metrics = analyzeDelivery("some words here some words here", [
      phrase(0),
      phrase(2.5),
    ]);
    expect(metrics.longPauseCount).toBe(0);
  });

  it("counts a real gather-your-thoughts gap", () => {
    const metrics = analyzeDelivery("some words here some words here", [
      phrase(0),
      phrase(4),
    ]);
    expect(metrics.longPauseCount).toBe(1);
  });

  it("counts from the published threshold, so the page cannot disagree", () => {
    const metrics = analyzeDelivery("some words here some words here", [
      phrase(0),
      phrase(1 + LONG_PAUSE_SECONDS),
    ]);
    expect(metrics.longPauseCount).toBe(1);
  });
});
