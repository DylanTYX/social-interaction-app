"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The per-answer countdown, and the auto-submit when it runs out.
 *
 * This existed twice — `chat-input.tsx` and `voice-input.tsx` — with two
 * different `formatRemainingTime` implementations that disagreed on negative
 * input (one clamped, one printed `-1:-5`). Adding the code editor to technical
 * rounds would have made it three copies, and a third copy is where behaviour
 * starts to drift for real: a candidate who switches from prose to the editor
 * mid-round must not silently get an untimed answer.
 *
 * The deadline is captured once, on mount, rather than derived from a ticking
 * count. The inputs are remounted between turns (`key={userTurnKey}` on the
 * chat page), so mount is exactly "this turn started" — and an absolute
 * deadline cannot drift the way a decrementing counter does when the tab is
 * backgrounded and `setInterval` is throttled.
 */

export function formatRemainingTime(seconds: number) {
  // Clamped, because `deadline - now` goes negative between the deadline
  // passing and the auto-submit landing, and "-0:-1" is not a time.
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

export function useAnswerTimer({
  timeLimitSeconds,
  disabled,
  onExpire,
}: {
  timeLimitSeconds: number;
  /** While disabled the clock stops — the interviewer is speaking, not the candidate. */
  disabled?: boolean;
  /**
   * Called once, when the deadline passes. Return `false` to say "I could not
   * submit" — the timer then stays armed and retries on the next tick rather
   * than dropping the answer on the floor.
   */
  onExpire: () => boolean;
}) {
  const [deadlineMs] = useState<number>(
    () => Date.now() + timeLimitSeconds * 1000,
  );
  const [clockMs, setClockMs] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasExpiredRef = useRef(false);
  // Held in a ref so a caller that rebuilds `onExpire` every render — which is
  // every caller, since it closes over the draft answer — does not tear down
  // and re-arm the interval on each keystroke.
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (disabled) {
      clearTimer();
      return;
    }

    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      const now = Date.now();
      setClockMs(now);

      if (now < deadlineMs || hasExpiredRef.current) return;

      hasExpiredRef.current = true;
      if (!onExpireRef.current()) {
        hasExpiredRef.current = false;
      }
    }, 250);

    return clearTimer;
  }, [clearTimer, deadlineMs, disabled]);

  useEffect(() => clearTimer, [clearTimer]);

  const remainingSeconds = Math.max(
    0,
    Math.ceil((deadlineMs - clockMs) / 1000),
  );

  return {
    remainingSeconds,
    timerText: formatRemainingTime(remainingSeconds),
    // Under a minute, or the last 15% of a short limit — whichever is sooner,
    // so a 60-second limit does not spend its whole life in the warning colour.
    isWarning: remainingSeconds <= Math.min(60, timeLimitSeconds * 0.15),
  };
}
