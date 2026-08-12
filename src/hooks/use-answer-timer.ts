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
 * The deadline is absolute rather than a decrementing count, so it cannot drift
 * when the tab is backgrounded and `setInterval` is throttled. It is stamped on
 * mount, which is exactly "this turn started" because the inputs are remounted
 * between turns (`key={userTurnKey}` on the chat page) — with one exception the
 * hook has to handle itself: `setUserTurnKey` sits inside the send's `try`, so
 * a *failed* send does not remount the input. Without the pause accounting
 * below, the whole failed round-trip was charged to the candidate's clock, and
 * a slow failure could re-enable the input with a deadline already in the past
 * — auto-submitting "[No response submitted…]" on the very first tick.
 *
 * This hook deliberately holds no ticking state. It used to: a `clockMs` that
 * advanced four times a second, which re-rendered whichever input called it —
 * including `CodeInput`, and with it a CodeMirror instance — for the entire
 * length of an answer. Nothing about *expiry* needs a render, only the
 * displayed digits do, so the digits moved into `<AnswerCountdown>` and this
 * kept the part that has to close over the draft answer.
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
  const [deadlineMs, setDeadlineMs] = useState<number>(
    () => Date.now() + timeLimitSeconds * 1000,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasExpiredRef = useRef(false);
  // When the clock was paused (disabled), so the paused span can be handed back
  // on resume rather than silently counted against the candidate.
  const pausedAtRef = useRef<number | null>(null);
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
      // Mark the moment the clock stopped, once — the input can be disabled and
      // re-rendered several times without the pause restarting.
      if (pausedAtRef.current === null) pausedAtRef.current = Date.now();
      clearTimer();
      return;
    }

    // Re-enabling. A failed send disables the input for the whole network
    // round-trip — up to a full timeout — and that time was not the candidate's
    // to spend. Push the deadline forward by however long we were paused, then
    // let the resulting re-render re-arm the interval against the new deadline;
    // without this the deadline could already be in the past on resume and the
    // timer would auto-submit on its first tick.
    if (pausedAtRef.current !== null) {
      const pausedFor = Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
      if (pausedFor > 0) {
        setDeadlineMs((current) => current + pausedFor);
        return;
      }
    }

    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      if (Date.now() < deadlineMs || hasExpiredRef.current) return;

      hasExpiredRef.current = true;
      if (onExpireRef.current()) {
        // Submitted. The timer's work is done — stop ticking rather than spin
        // every 250ms until unmount, short-circuiting on `hasExpiredRef`.
        clearTimer();
      } else {
        hasExpiredRef.current = false;
      }
    }, 250);

    return clearTimer;
  }, [clearTimer, deadlineMs, disabled]);

  useEffect(() => clearTimer, [clearTimer]);

  // The deadline is all a caller needs: hand it to `<AnswerCountdown>` to
  // render, and the ticking stays inside that leaf.
  return { deadlineMs };
}

/**
 * Under a minute, or the last 15% of a short limit — whichever is sooner, so a
 * 60-second limit does not spend its whole life in the warning colour.
 */
export function isTimerWarning(
  remainingSeconds: number,
  timeLimitSeconds: number,
) {
  return remainingSeconds <= Math.min(60, timeLimitSeconds * 0.15);
}
