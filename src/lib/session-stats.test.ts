import { describe, expect, it } from "vitest";

import type { InterviewSessionSummary } from "@/hooks/use-interview-history";
import {
  computeSessionStats,
  formatAverageScore,
  formatPracticeMinutes,
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
