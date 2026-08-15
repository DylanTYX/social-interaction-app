import { describe, expect, it } from "vitest";

import type { InterviewSessionSummary } from "@/hooks/use-interview-history";
import {
  computeSessionStats,
  describeStatsWindow,
  formatAverageScore,
  formatPracticeMinutes,
  STATS_WINDOW,
  MIN_TURNS_TO_SCORE,
  MIN_SCORED_TURNS,
} from "@/lib/session-stats";

function session(
  partial: Partial<InterviewSessionSummary> = {},
): InterviewSessionSummary {
  return {
    id: "s1",
    practiceMode: "text",
    scenarioTitle: null,
    scenarioValue: "custom",
    personaName: "Sarah Chen",
    status: "completed",
    // Comfortably past `MIN_TURNS_TO_SCORE`, so the default fixture is a real
    // session; tests that care about short ones set it explicitly.
    turnCount: 12,
    averageScore: 70,
    durationMinutes: 20,
    startedAt: "2026-01-01T00:00:00Z",
    endedAt: "2026-01-01T00:20:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("computeSessionStats", () => {
  it("counts every session but averages only the scored ones", () => {
    // The distinction that matters: an in-progress session is practice time and
    // a session count, but it must not drag the average down as a zero.
    const stats = computeSessionStats([
      session({ averageScore: 80 }),
      session({ averageScore: 60 }),
      session({ averageScore: null, status: "in_progress" }),
    ]);

    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(2);
    expect(stats.averageScore).toBe(70);
  });

  it("ignores a session too short to mean anything", () => {
    // The loophole this closes: "End session" is available from turn one, so
    // answering one question well and ending — repeatedly — used to pull the
    // headline average up and unlock the score badges. A two-message session is
    // one answer; it is practice, but it is not evidence.
    const stats = computeSessionStats([
      session({ averageScore: 60, turnCount: 12 }),
      session({ averageScore: 100, turnCount: 2 }),
    ]);

    expect(stats.averageScore).toBe(60);
    expect(stats.bestScore).toBe(60);
    // Still counted as practice, and still listed.
    expect(stats.total).toBe(2);
    expect(stats.scoredSessions).toBe(1);
  });

  it("ignores an in-progress session that already carries a score", () => {
    // `persistTurn` writes `averageScore` on every turn, so an abandoned
    // interview has one long before it is finished. It used to count.
    const stats = computeSessionStats([
      session({ averageScore: 60, status: "completed" }),
      session({ averageScore: 95, status: "in_progress" }),
    ]);

    expect(stats.averageScore).toBe(60);
    expect(stats.scoredSessions).toBe(1);
  });

  it("counts a session exactly at the threshold", () => {
    const stats = computeSessionStats([
      session({ averageScore: 80, turnCount: MIN_TURNS_TO_SCORE }),
    ]);
    expect(stats.averageScore).toBe(80);
  });

  it("prefers scored answers over messages when it knows both", () => {
    // The residual hole in the message-count gate: the analyzer skips one-word
    // replies and the timer's no-response placeholder, so a session can clear
    // twelve messages on a single graded answer. Counting analyses is what
    // "three answered questions" actually meant.
    const stats = computeSessionStats([
      session({ averageScore: 60, turnCount: 12, scoredTurnCount: 5 }),
      session({ averageScore: 100, turnCount: 12, scoredTurnCount: 1 }),
    ]);

    expect(stats.averageScore).toBe(60);
    expect(stats.scoredSessions).toBe(1);
  });

  it("counts a session exactly at the scored-answer threshold", () => {
    const stats = computeSessionStats([
      session({
        averageScore: 80,
        turnCount: 12,
        scoredTurnCount: MIN_SCORED_TURNS,
      }),
    ]);
    expect(stats.averageScore).toBe(80);
  });

  it("falls back to the message count when the scored count is absent", () => {
    // Payloads written before the embed existed, and any caller that did not
    // ask for it. Dropping those sessions from the average would be a worse
    // answer than the old approximation.
    const stats = computeSessionStats([
      session({ averageScore: 65, turnCount: 12, scoredTurnCount: null }),
      session({ averageScore: 90, turnCount: 2, scoredTurnCount: undefined }),
    ]);

    expect(stats.averageScore).toBe(65);
    expect(stats.scoredSessions).toBe(1);
  });

  it("does not round the average", () => {
    // One of the two old implementations rounded inside the calculation, the
    // other at display. A caller wanting a decimal place should not have to
    // undo someone else's Math.round.
    const stats = computeSessionStats([
      session({ averageScore: 70 }),
      session({ averageScore: 71 }),
    ]);
    expect(stats.averageScore).toBe(70.5);
  });

  it("returns null rather than 0 when nothing is scored", () => {
    // 0 would render as "0%", which claims the user scored zero rather than
    // that they have not been scored.
    const stats = computeSessionStats([
      session({ averageScore: null, status: "in_progress" }),
    ]);
    expect(stats.averageScore).toBeNull();
    expect(stats.bestScore).toBeNull();
  });

  it("treats a missing duration as zero, not NaN", () => {
    const stats = computeSessionStats([
      session({ durationMinutes: null }),
      session({ durationMinutes: 15 }),
    ]);
    expect(stats.totalMinutes).toBe(15);
  });

  it("splits the mode mix so the two counts always sum to the total", () => {
    const stats = computeSessionStats([
      session({ practiceMode: "voice" }),
      session({ practiceMode: "voice" }),
      session({ practiceMode: "text" }),
    ]);
    expect(stats.voiceCount).toBe(2);
    expect(stats.textCount).toBe(1);
    expect(stats.voiceCount + stats.textCount).toBe(stats.total);
  });

  it("survives an empty list without dividing by zero", () => {
    const stats = computeSessionStats([]);
    expect(stats).toEqual({
      total: 0,
      completed: 0,
      scoredSessions: 0,
      averageScore: null,
      bestScore: null,
      totalMinutes: 0,
      voiceCount: 0,
      textCount: 0,
    });
  });

  it("takes the best score, not the last", () => {
    const stats = computeSessionStats([
      session({ averageScore: 90 }),
      session({ averageScore: 40 }),
    ]);
    expect(stats.bestScore).toBe(90);
  });
});

describe("formatPracticeMinutes", () => {
  it("formats zero one way, not two", () => {
    // The visible symptom of the duplication: home printed "0m", analytics
    // printed "0 min", for the same number.
    expect(formatPracticeMinutes(0)).toBe("0 min");
    expect(formatPracticeMinutes(-5)).toBe("0 min");
  });

  it("switches to hours at 60 minutes", () => {
    expect(formatPracticeMinutes(59)).toBe("59 min");
    expect(formatPracticeMinutes(60)).toBe("1.0h");
    expect(formatPracticeMinutes(150)).toBe("2.5h");
  });
});

describe("formatAverageScore", () => {
  it("renders an em dash for unscored, never 0%", () => {
    expect(formatAverageScore(null)).toBe("—");
    expect(formatAverageScore(0)).toBe("0%");
    expect(formatAverageScore(70.4)).toBe("70%");
  });
});

describe("describeStatsWindow", () => {
  it("says 'All time' only while that is actually true", () => {
    // The bug this replaces: home fetched 25 sessions and captioned the total
    // "All time" regardless.
    expect(describeStatsWindow(0)).toBe("All time");
    expect(describeStatsWindow(STATS_WINDOW - 1)).toBe("All time");
  });

  it("stops claiming 'All time' once the window is saturated", () => {
    expect(describeStatsWindow(STATS_WINDOW)).toBe(
      `Last ${STATS_WINDOW} sessions`,
    );
  });
});
