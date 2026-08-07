import { describe, expect, it } from "vitest";

import { TurnTimer } from "@/lib/api/turn-timing";

/**
 * Turn timing exists to answer one question — "why does the reply take a
 * while?" — so the thing worth testing is that it attributes the wait to the
 * right stages, and that it cannot itself fail a turn.
 */

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("TurnTimer", () => {
  it("counts only the stages that run before the first token", async () => {
    // The distinction the whole module exists for: the summary refresh and
    // coverage scoring are real model calls, but they run after the reply is on
    // the wire, so they are not what the candidate is waiting on.
    const timer = new TurnTimer();

    await timer.time("analysis", true, () => tick(20));
    await timer.time("summary", false, () => tick(20));

    expect(timer.blockingMs()).toBeGreaterThanOrEqual(15);
    expect(timer.blockingMs()).toBeLessThan(40);
    expect(timer.all()).toHaveLength(2);
  });

  it("records a stage that threw, then rethrows", async () => {
    // A failing stage is exactly the one you want timed — a scorer that takes
    // four seconds to error is the worst case, not the uninteresting one.
    const timer = new TurnTimer();

    await expect(
      timer.time("analysis", true, async () => {
        await tick(10);
        throw new Error("scorer exploded");
      }),
    ).rejects.toThrow("scorer exploded");

    expect(timer.all().map((mark) => mark.stage)).toEqual(["analysis"]);
  });

  it("logs nothing when nothing was measured", () => {
    // An opening turn scores no answer; a log line claiming otherwise would be
    // noise in exactly the place someone is looking for signal.
    const timer = new TurnTimer();
    expect(() => timer.log({ sessionId: "s1" })).not.toThrow();
    expect(timer.blockingMs()).toBe(0);
  });
});
