import { describe, expect, it } from "vitest";

import type { InterviewSessionSummary } from "@/hooks/use-interview-history";
import {
  computePracticeProgress,
  MIN_TURNS_TO_PRACTISE,
} from "@/lib/practice-goals";

/**
 * What counts as having practised this week.
 *
 * The session row is created at the end of the setup wizard, before a word is
 * exchanged — so the weekly goal used to count *launches*. Opening the wizard
 * and closing the tab three times on a Monday read "3/3 · Goal hit".
 */

// Wednesday 16 September 2026, midday local time.
const NOW = new Date(2026, 8, 16, 12, 0, 0);

function at(day: number, hour = 10): string {
  return new Date(2026, 8, day, hour, 0, 0).toISOString();
}

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
    startedAt: at(16),
    endedAt: at(16, 11),
    createdAt: at(16),
    ...partial,
  };
}

describe("computePracticeProgress", () => {
  it("counts a real session toward the week", () => {
    const progress = computePracticeProgress([session(), session()], NOW);
    expect(progress.thisWeek).toBe(2);
  });

  it("does not count a launch that never became an interview", () => {
    // The loophole: launch, close the tab, repeat. `turn_count` is still 0.
    const progress = computePracticeProgress(
      [session({ turnCount: 0 }), session({ turnCount: 0 })],
      NOW,
    );
    expect(progress.thisWeek).toBe(0);
    expect(progress.days.every((day) => day.sessions === 0)).toBe(true);
  });

  it("counts a short session — showing up is the point", () => {
    const progress = computePracticeProgress(
      [session({ turnCount: MIN_TURNS_TO_PRACTISE })],
      NOW,
    );
    expect(progress.thisWeek).toBe(1);
  });

  it("lays out Monday to Sunday with each day's sessions", () => {
    const progress = computePracticeProgress(
      [
        session({ createdAt: at(14) }), // Monday
        session({ createdAt: at(16) }), // Wednesday
        session({ createdAt: at(16, 18) }),
        session({ createdAt: at(12) }), // last Saturday: not this week
      ],
      NOW,
    );

    expect(progress.days.map((day) => day.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(progress.days.map((day) => day.sessions)).toEqual([
      1, 0, 2, 0, 0, 0, 0,
    ]);
    expect(progress.thisWeek).toBe(3);
    expect(progress.days[2]).toMatchObject({ isToday: true, isFuture: false });
    expect(progress.days[3].isFuture).toBe(true);
    expect(progress.days[1].isFuture).toBe(false);
  });
});
