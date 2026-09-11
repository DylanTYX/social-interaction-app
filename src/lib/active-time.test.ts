import { describe, expect, it } from "vitest";

import {
  ACTIVITY_CHUNK_SECONDS,
  MAX_COUNTED_GAP_MS,
  createActiveTimeTracker,
} from "@/lib/active-time";

/**
 * Session duration was `ended_at - started_at`, so leaving an interview for an
 * hour and resuming it added the hour to the report, the dashboard's practice
 * time and the loop total. The tracker decides which seconds count now; these
 * pin the cases the wall clock got wrong, and the ones a naive counter would.
 */

const SECOND = 1000;

describe("createActiveTimeTracker", () => {
  it("counts nothing until it is told to", () => {
    const tracker = createActiveTimeTracker();
    expect(tracker.take(45 * SECOND)).toBe(0);
  });

  it("counts time on screen and none of the time away", () => {
    const tracker = createActiveTimeTracker();
    tracker.setCounting(true, 0);
    expect(tracker.take(30 * SECOND)).toBe(30);

    // Switched tab at 40s, back an hour later.
    tracker.setCounting(false, 40 * SECOND);
    tracker.setCounting(true, 3_640 * SECOND);
    expect(tracker.take(3_660 * SECOND)).toBe(10 + 20);
  });

  it("reports at most one request's worth and keeps the rest", () => {
    const tracker = createActiveTimeTracker();
    tracker.setCounting(true, 0);
    // Read every 30s, as the page does, for five minutes without a report landing.
    for (let t = 30; t <= 300; t += 30) tracker.setCounting(true, t * SECOND);
    tracker.setCounting(false, 300 * SECOND);

    expect(tracker.take(300 * SECOND)).toBe(ACTIVITY_CHUNK_SECONDS);
    expect(tracker.take(300 * SECOND)).toBe(ACTIVITY_CHUNK_SECONDS);
    expect(tracker.take(300 * SECOND)).toBe(60);
    expect(tracker.take(300 * SECOND)).toBe(0);
  });

  it("carries seconds whose report failed into the next one", () => {
    const tracker = createActiveTimeTracker();
    tracker.setCounting(true, 0);
    const sent = tracker.take(25 * SECOND);
    tracker.restore(sent);
    expect(tracker.take(30 * SECOND)).toBe(30);
  });

  it("does not count a laptop asleep with the interview on screen", () => {
    const tracker = createActiveTimeTracker();
    tracker.setCounting(true, 0);
    // No reading for eight hours, then the page wakes still "visible".
    const counted = tracker.take(8 * 3_600 * SECOND);
    expect(counted).toBe(MAX_COUNTED_GAP_MS / SECOND);
  });

  it("keeps fractions of a second for later instead of rounding them away", () => {
    const tracker = createActiveTimeTracker();
    tracker.setCounting(true, 0);
    expect(tracker.take(29_600)).toBe(29);
    expect(tracker.take(30_000)).toBe(1);
  });

  it("does not restart the count when told to count while already counting", () => {
    const tracker = createActiveTimeTracker();
    tracker.setCounting(true, 0);
    tracker.setCounting(true, 20 * SECOND);
    expect(tracker.take(50 * SECOND)).toBe(50);
  });
});
