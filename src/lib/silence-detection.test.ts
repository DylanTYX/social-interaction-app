import { describe, expect, it } from "vitest";

import {
  decideSilence,
  SILENCE_SUBMIT_MS,
  SILENCE_WARN_AT_MS,
} from "@/lib/silence-detection";

const at = (
  quietForMs: number,
  overrides: Partial<Parameters<typeof decideSilence>[0]> = {},
) =>
  decideSilence({
    nowMs: 10_000,
    lastSpeechAtMs: 10_000 - quietForMs,
    hasSpoken: true,
    ...overrides,
  });

describe("decideSilence", () => {
  it("keeps listening while the candidate is still talking", () => {
    expect(at(0)).toEqual({ kind: "listening" });
    expect(at(SILENCE_WARN_AT_MS - 1)).toEqual({ kind: "listening" });
  });

  it("warns before it submits, so submission is never a surprise", () => {
    const decision = at(SILENCE_WARN_AT_MS);
    expect(decision.kind).toBe("warning");
    expect(decision).toMatchObject({
      msRemaining: SILENCE_SUBMIT_MS - SILENCE_WARN_AT_MS,
    });
  });

  it("submits once the pause reaches the threshold", () => {
    expect(at(SILENCE_SUBMIT_MS)).toEqual({ kind: "submit" });
    expect(at(SILENCE_SUBMIT_MS + 5_000)).toEqual({ kind: "submit" });
  });

  it("never submits before the candidate has said anything", () => {
    // The gate that matters. Someone gathering their thoughts for four seconds
    // after the mic opens must not have an empty answer submitted for them —
    // initial silence belongs to the three-minute response timer.
    expect(at(SILENCE_SUBMIT_MS * 10, { hasSpoken: false })).toEqual({
      kind: "listening",
    });
    expect(at(SILENCE_SUBMIT_MS * 10, { lastSpeechAtMs: null })).toEqual({
      kind: "listening",
    });
  });

  it("resets when speech resumes", () => {
    // A pause mid-thought must not accumulate toward the threshold: the caller
    // restamps `lastSpeechAtMs` on every interim result, and the decision is
    // computed from that stamp alone rather than from anything it remembers.
    expect(at(2_900).kind).toBe("warning");
    expect(at(0).kind).toBe("listening");
  });

  it("honours a caller-supplied threshold", () => {
    expect(at(1_200, { submitAfterMs: 1_000, warnAfterMs: 500 })).toEqual({
      kind: "submit",
    });
  });
});
