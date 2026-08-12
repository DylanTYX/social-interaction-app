import { describe, expect, it } from "vitest";

import type { InterviewSessionSummary } from "@/hooks/use-interview-history";
import {
  computePracticeProgress,
  MIN_TURNS_TO_PRACTISE,
} from "@/lib/practice-goals";

/**
 * What counts as having practised.
 *
 * The session row is created at the end of the setup wizard, before a word is
 * exchanged — so goals and streaks used to count *launches*. Opening the wizard
 * and closing the tab three times on a Monday read "3/3 · Goal hit". A streak
 * that rewards opening a page is worse than no streak.
 */

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
    turnCount: 12,
    averageScore: 70,
    durationMinutes: 20,
    startedAt: "2026-01-01T00:00:00Z",
    endedAt: "2026-01-01T00:20:00Z",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("computePracticeProgress", () => {
  it("counts a real session toward the week", () => {
    const progress = computePracticeProgress([session(), session()]);
    expect(progress.thisWeek).toBe(2);
  });

  it("does not count a launch that never became an interview", () => {
    // The loophole: launch, close the tab, repeat. `turn_count` is still 0.
    const progress = computePracticeProgress([
      session({ turnCount: 0 }),
      session({ turnCount: 0 }),
      session({ turnCount: 0 }),
    ]);

    expect(progress.thisWeek).toBe(0);
    expect(progress.streakDays).toBe(0);
  });

  it("counts a short session — showing up is the point", () => {
    // Deliberately a lower bar than `MIN_TURNS_TO_SCORE`. A brief session is
    // still practice and should keep a streak alive; it just must not vote on
    // how good you are.
    const progress = computePracticeProgress([
      session({ turnCount: MIN_TURNS_TO_PRACTISE }),
    ]);

    expect(progress.thisWeek).toBe(1);
    expect(progress.streakDays).toBe(1);
  });

  it("reports no streak for an empty history", () => {
    const progress = computePracticeProgress([]);
    expect(progress).toMatchObject({
      thisWeek: 0,
      streakDays: 0,
      bestStreak: 0,
    });
  });

  it("counts one streak day however many sessions that day held", () => {
    const today = new Date().toISOString();
    const progress = computePracticeProgress([
      session({ createdAt: today }),
      session({ createdAt: today }),
      session({ createdAt: today }),
    ]);

    expect(progress.thisWeek).toBe(3);
    expect(progress.streakDays).toBe(1);
  });
});
