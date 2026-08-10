"use client";

import { useEffect, useState } from "react";

import { formatRemainingTime, isTimerWarning } from "@/hooks/use-answer-timer";
import { cn } from "@/lib/utils";

/**
 * The "Response timer: 04:32" line above the answer box.
 *
 * A leaf on purpose. The clock this displays advances four times a second, and
 * it used to live in whichever input rendered it — so every tick re-rendered a
 * `<Textarea>` holding the candidate's draft, or worse, the `CodeMirror`
 * instance in `CodeInput`, for the whole five minutes of an answer. Only these
 * digits change, so only these digits re-render.
 *
 * Both the deadline and the clock reading are held in one piece of state that
 * is only ever written from a timer callback, never synchronously from the
 * effect body and never read from a ref during render. That keeps `Date.now()`
 * — the one genuinely impure thing here — out of the render path entirely,
 * which is a constraint the voice input's hand-rolled predecessor already
 * documented and which the lint rules enforce.
 */
export function AnswerCountdown({
  deadlineMs,
  timeLimitSeconds,
  paused = false,
  label = "Response timer",
  suffix,
  className,
}: {
  /**
   * Supplied by `useAnswerTimer`, which owns expiry and auto-submit. Omit it
   * and the countdown stamps its own deadline the first time it runs — the
   * voice input does that, because its clock starts when recording starts
   * rather than when the component mounts.
   */
  deadlineMs?: number;
  timeLimitSeconds: number;
  /**
   * Stops the clock, holding the digits at their last reading — the
   * interviewer is speaking, not the candidate. To reset to the full limit
   * instead of holding, remount with a `key`.
   */
  paused?: boolean;
  label?: string;
  /** Trailing note, e.g. "starts when the interviewer finishes". */
  suffix?: React.ReactNode;
  className?: string;
}) {
  const [reading, setReading] = useState<{
    deadlineMs: number;
    clockMs: number;
  } | null>(null);

  useEffect(() => {
    if (paused) return;

    const deadline = deadlineMs ?? Date.now() + timeLimitSeconds * 1000;
    const sample = () =>
      setReading({ deadlineMs: deadline, clockMs: Date.now() });

    // First sample on a microtask rather than inline, so the effect body
    // itself contains no synchronous setState.
    queueMicrotask(sample);
    const id = setInterval(sample, 250);
    return () => clearInterval(id);
  }, [paused, deadlineMs, timeLimitSeconds]);

  // Before the first sample lands, show the full limit rather than 00:00.
  const remainingSeconds = reading
    ? Math.max(0, Math.ceil((reading.deadlineMs - reading.clockMs) / 1000))
    : timeLimitSeconds;
  const warning = isTimerWarning(remainingSeconds, timeLimitSeconds);

  return (
    <div
      className={cn(
        "text-xs font-medium transition-colors duration-150",
        warning ? "text-red-600" : "text-slate-500",
        className,
      )}
    >
      {label}: {formatRemainingTime(remainingSeconds)}
      {suffix}
    </div>
  );
}
