/**
 * Which seconds of an interview count toward its duration.
 *
 * Duration was `ended_at - started_at`. Leave a session for an hour and resume
 * it, and the hour was practice time — on the report, the dashboard's total and
 * the loop summary. What should count is the time the session page was open
 * and on screen, so the page adds that up here and reports it in small pieces
 * (`useActiveSessionTime`), and the server derives the duration from the total.
 *
 * Pure and clock-injected so the cases a wall clock got wrong can be tested
 * without timers or a DOM.
 */

/** The most one report may add. Matches `record_session_activity`'s cap. */
export const ACTIVITY_CHUNK_SECONDS = 120;

/** How often a visible session page reports what it has counted. */
export const ACTIVITY_FLUSH_INTERVAL_MS = 30_000;

/**
 * The longest stretch counted between two readings.
 *
 * A visible page is read at least every `ACTIVITY_FLUSH_INTERVAL_MS`, so a
 * longer gap means the page was not really running — most often a laptop
 * closed with the interview on screen, which stays "visible" throughout and
 * would otherwise add the whole night on waking.
 */
export const MAX_COUNTED_GAP_MS = 2 * ACTIVITY_FLUSH_INTERVAL_MS;

export interface ActiveTimeTracker {
  /** Count from now (the page is on screen and the interview running), or stop. */
  setCounting(counting: boolean, nowMs: number): void;
  /** Remove and return whole seconds counted so far, at most one report's worth. */
  take(nowMs: number): number;
  /** Return seconds whose report failed, so the next one carries them. */
  restore(seconds: number): void;
}

export function createActiveTimeTracker(): ActiveTimeTracker {
  let countingSince: number | null = null;
  let pendingMs = 0;

  const settle = (nowMs: number) => {
    if (countingSince === null) return;
    pendingMs += Math.min(Math.max(0, nowMs - countingSince), MAX_COUNTED_GAP_MS);
    countingSince = nowMs;
  };

  return {
    setCounting(counting, nowMs) {
      settle(nowMs);
      countingSince = counting ? (countingSince ?? nowMs) : null;
    },
    take(nowMs) {
      settle(nowMs);
      // Whole seconds only; the fraction stays for the next report rather than
      // being rounded away thirty seconds at a time.
      const seconds = Math.min(Math.floor(pendingMs / 1000), ACTIVITY_CHUNK_SECONDS);
      pendingMs -= seconds * 1000;
      return seconds;
    },
    restore(seconds) {
      pendingMs += Math.max(0, seconds) * 1000;
    },
  };
}
