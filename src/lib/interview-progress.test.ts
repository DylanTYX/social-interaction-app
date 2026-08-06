import { describe, expect, it } from "vitest";

import {
  suggestedBreakMinutes,
  DEFAULT_TARGET_TURNS,
  describeRoundLength,
  isInterviewComplete,
  targetTurnsForDuration,
  targetTurnsForRound,
} from "@/lib/interview-progress";
import {
  createInterviewSessionState,
  interviewStage,
  recordInterviewTurn,
} from "@/lib/interview-session-state";

describe("targetTurnsForDuration", () => {
  it("scales with the configured length", () => {
    // Every session used to run a flat 12 turns regardless of duration, so a
    // 5-minute screen and a 60-minute design round were identical.
    expect(targetTurnsForDuration(10)).toBe(5);
    expect(targetTurnsForDuration(20)).toBe(10);
    expect(targetTurnsForDuration(30)).toBe(15);
  });

  it("clamps at both ends", () => {
    expect(targetTurnsForDuration(1)).toBe(4);
    expect(targetTurnsForDuration(240)).toBe(20);
  });

  it("falls back on a missing or nonsense duration", () => {
    expect(targetTurnsForDuration(0)).toBe(DEFAULT_TARGET_TURNS);
    expect(targetTurnsForDuration(Number.NaN)).toBe(DEFAULT_TARGET_TURNS);
    expect(targetTurnsForRound(undefined)).toBe(DEFAULT_TARGET_TURNS);
  });

  it("reads the duration off a round", () => {
    expect(targetTurnsForRound({ durationMinutes: 40 })).toBe(20);
  });
});

describe("describeRoundLength", () => {
  it("states the consequence, not just the number", () => {
    expect(describeRoundLength(20)).toBe("20 min · ~10 questions");
  });
});

describe("isInterviewComplete", () => {
  it("ends at the round's own target", () => {
    expect(isInterviewComplete(9, 10)).toBe(false);
    expect(isInterviewComplete(10, 10)).toBe(true);
    expect(isInterviewComplete(11, 10)).toBe(true);
  });
});

describe("interviewStage", () => {
  const advance = (times: number) => {
    let state = createInterviewSessionState("s1", "Alex");
    for (let i = 0; i < times; i += 1) {
      state = recordInterviewTurn(state, {});
    }
    return state;
  };

  it("walks intro -> questioning -> wrap_up -> report", () => {
    expect(interviewStage(advance(0), 10)).toBe("intro");
    expect(interviewStage(advance(3), 10)).toBe("questioning");
    expect(interviewStage(advance(8), 10)).toBe("wrap_up");
    expect(interviewStage(advance(10), 10)).toBe("report");
  });

  it("cannot get stuck", () => {
    // The old graph had no transition out of `wrap_up`, so one strong answer
    // pinned the label there for the rest of the session.
    const state = advance(4);
    expect(interviewStage(state, 10)).toBe("questioning");
    expect(interviewStage(advance(9), 10)).toBe("wrap_up");
    expect(interviewStage(advance(12), 10)).toBe("report");
  });

  it("agrees with the completion check", () => {
    for (let turns = 0; turns <= 14; turns += 1) {
      const state = advance(turns);
      expect(interviewStage(state, 10) === "report").toBe(
        isInterviewComplete(state.turnCount, 10),
      );
    }
  });
});

describe("recordInterviewTurn", () => {
  it("counts scored turns and does not mutate", () => {
    const first = createInterviewSessionState("s1", "Alex");
    const second = recordInterviewTurn(first, {});

    expect(first.turnCount).toBe(0);
    expect(second.turnCount).toBe(1);
  });
});

describe("suggestedBreakMinutes", () => {
  it("scales the breather with the round just finished", () => {
    expect(suggestedBreakMinutes(15)).toBe(0);
    expect(suggestedBreakMinutes(20)).toBe(5);
    expect(suggestedBreakMinutes(30)).toBe(5);
    expect(suggestedBreakMinutes(45)).toBe(10);
    expect(suggestedBreakMinutes(90)).toBe(10);
  });

  it("suggests nothing after a short screen", () => {
    // Replaces a `breakMinutes` select whose only effect anywhere was one
    // string on the report. Deriving it removes a decision without losing the
    // nudge.
    expect(suggestedBreakMinutes(5)).toBe(0);
  });
});
