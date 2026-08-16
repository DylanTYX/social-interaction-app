"use client";

import { useEffect, useState } from "react";

import { SILENCE_SUBMIT_MS, SILENCE_WARN_AT_MS } from "@/lib/silence-detection";
import { cn } from "@/lib/utils";

/**
 * "Submitting in 2s…" — the visible half of silence detection.
 *
 * A leaf for the same reason `AnswerCountdown` is one: the number it shows
 * changes several times a second, and the voice screen it lives on holds the
 * live transcript and the whole message list. Ticking here re-renders eleven
 * characters instead of the session.
 *
 * The parent hands down the moment the pause started and nothing else, so it
 * writes state once per pause rather than once per frame. Its own countdown is
 * derived, never stored.
 */
export function SilenceIndicator({
  silenceStartedAtMs,
  className,
}: {
  /** When the current pause began, or null while the candidate is speaking. */
  silenceStartedAtMs: number | null;
  className?: string;
}) {
  // The clock reading is stored *with* the pause it was taken during, so a
  // stale sample from the previous pause can be recognised and ignored rather
  // than cleared. Clearing would mean a setState in the effect body, which is
  // the one thing this file is not allowed to do.
  const [reading, setReading] = useState<{
    startedAt: number;
    nowMs: number;
  } | null>(null);

  useEffect(() => {
    if (silenceStartedAtMs === null) return;

    const sample = () =>
      setReading({ startedAt: silenceStartedAtMs, nowMs: Date.now() });
    // First sample on a microtask, so the effect body holds no synchronous
    // setState — the same constraint the lint rules enforce on AnswerCountdown.
    queueMicrotask(sample);
    const id = setInterval(sample, 100);
    return () => clearInterval(id);
  }, [silenceStartedAtMs]);

  if (silenceStartedAtMs === null) return null;
  if (!reading || reading.startedAt !== silenceStartedAtMs) return null;

  const quietFor = reading.nowMs - silenceStartedAtMs;
  if (quietFor < SILENCE_WARN_AT_MS) return null;

  // Ceil so it counts 2, 1 and submits, rather than showing a "0s" that lingers.
  const secondsLeft = Math.max(
    1,
    Math.ceil((SILENCE_SUBMIT_MS - quietFor) / 1000),
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
      Submitting in {secondsLeft}s…
    </div>
  );
}
