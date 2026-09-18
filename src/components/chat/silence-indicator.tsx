"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The visible half of silence detection: the countdown before a turn ends
 * itself.
 *
 * A leaf for the same reason `AnswerCountdown` is one: the number it shows
 * changes several times a second, and the voice screen it lives on holds the
 * live transcript and the whole message list. Ticking here re-renders eleven
 * characters instead of the session.
 *
 * It is handed a **deadline**, not a start time. It used to be given the start
 * of the pause and to work out the deadline from the in-answer constants, which
 * silently broke the moment a second kind of silence existed: the opening
 * countdown rendered as a permanent "Submitting in 1s…", because it was
 * measuring a ten-second wait against a four-second rule and clamping the
 * negative result. The component no longer knows any thresholds.
 */
export function SilenceIndicator({
  deadline,
  className,
}: {
  /** When the turn ends itself, and what happens then. Null while speaking. */
  deadline: { atMs: number; pending: "submit" | "prompt" } | null;
  className?: string;
}) {
  // The clock reading is stored *with* the deadline it was taken for, so a
  // stale sample from a previous pause can be recognised and ignored rather
  // than cleared. Clearing would mean a setState in the effect body, which is
  // the one thing this file is not allowed to do.
  const [reading, setReading] = useState<{
    atMs: number;
    nowMs: number;
  } | null>(null);

  const deadlineAtMs = deadline?.atMs ?? null;

  useEffect(() => {
    if (deadlineAtMs === null) return;

    const sample = () => setReading({ atMs: deadlineAtMs, nowMs: Date.now() });
    // First sample on a microtask, so the effect body holds no synchronous
    // setState — the same constraint the lint rules enforce on AnswerCountdown.
    queueMicrotask(sample);
    const id = setInterval(sample, 100);
    return () => clearInterval(id);
  }, [deadlineAtMs]);

  if (deadline === null || deadlineAtMs === null) return null;
  if (!reading || reading.atMs !== deadlineAtMs) return null;

  // Ceil so it counts 2, 1 and then acts, rather than showing a lingering "0s".
  const secondsLeft = Math.max(
    1,
    Math.ceil((deadlineAtMs - reading.nowMs) / 1000),
  );

  return (
    <div
      // Polite, not assertive: this is a hint, and it must not interrupt a
      // screen reader mid-transcript.
      aria-live="polite"
      className={cn(
        "text-xs font-medium text-warning transition-colors duration-150",
        className,
      )}
    >
      {deadline.pending === "submit"
        ? `Submitting in ${secondsLeft}s…`
        : // Nothing of the candidate's is being submitted here — they have not
          // said anything. Saying "submitting" would report their silence as an
          // answer they gave.
          `Checking you're still there in ${secondsLeft}s…`}
    </div>
  );
}
