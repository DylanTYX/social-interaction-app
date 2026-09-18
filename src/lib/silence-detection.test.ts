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

describe("a pause to think", () => {
  /**
   * The thing this threshold exists to protect. Mid-answer thinking pauses are
   * reported to the candidate but never scored (docs/DESIGN-DECISIONS.md §15),
   * so the interaction must not end a turn on one either. Three seconds used to
   * submit; it now warns and keeps listening.
   */
  it("keeps listening through a three-second think", () => {
    expect(at(3_000).kind).toBe("warning");
  });

  it("warns for long enough to be noticed before it submits", () => {
    expect(SILENCE_SUBMIT_MS - SILENCE_WARN_AT_MS).toBeGreaterThanOrEqual(
      2_000,
    );
  });
});

/**
 * The silence before a candidate says anything at all.
 *
 * A different event from a pause inside an answer, and it used to be handled by
 * accident: the three-minute *answer length* cap was also the never-spoke
 * fallback, so someone who missed the question sat in silence for three minutes
 * before anything happened.
 */
describe("silence before the first word", () => {
  const base = {
    hasSpoken: false,
    lastSpeechAtMs: null,
    turnStartedAtMs: 0,
  };

  it("waits, because composing an answer is not a fault", () => {
    expect(decideSilence({ ...base, nowMs: 3_000 })).toEqual({
      kind: "listening",
    });
  });

  it("warns before it acts, and counts down to the right deadline", () => {
    const decision = decideSilence({ ...base, nowMs: 6_000 });
    expect(decision).toEqual({
      kind: "warning",
      msRemaining: 4_000,
      // The deadline travels with the warning so the countdown on screen does
      // not have to guess which of the two silence rules produced it. Guessing
      // is what made the opening countdown read "Submitting in 1s…" for its
      // whole duration.
      deadlineAtMs: 10_000,
      pending: "prompt",
    });
  });

  it("asks the interviewer to check in once the silence is unmistakable", () => {
    expect(decideSilence({ ...base, nowMs: 10_000 })).toEqual({
      kind: "prompt",
    });
  });

  it("does nothing at all until the microphone has actually opened", () => {
    // No start time means no turn in progress; a countdown here would run
    // against a candidate who is not being asked anything.
    expect(
      decideSilence({ ...base, turnStartedAtMs: null, nowMs: 999_999 }),
    ).toEqual({ kind: "listening" });
  });

  it("hands over to the in-answer rule the moment a word is heard", () => {
    // One word spoken 30s in must not be read as 30s of opening silence.
    expect(
      decideSilence({
        nowMs: 30_000,
        hasSpoken: true,
        lastSpeechAtMs: 29_500,
        turnStartedAtMs: 0,
      }),
    ).toEqual({ kind: "listening" });
  });
});
