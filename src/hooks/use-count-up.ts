"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Animates a number up to a target with an ease-out curve.
 *
 * This was written three times independently — in `stat-counter.tsx`,
 * `try-question.tsx` and `animated-demo.tsx` — with the same rAF loop and the
 * same `1 - (1-t)^3` easing, but three different durations and only one of the
 * three cancelling its frame on unmount. The report's score reveal wanted a
 * fourth copy, which is where this became worth extracting.
 *
 * Reduced motion is checked here rather than in CSS because the animation is a
 * sequence of React state updates; no stylesheet can reach it. When it's set,
 * `start` jumps straight to the target — the number is information, so it must
 * still arrive, just without the travel.
 *
 * Returns the current display value and a `start` you call when the count
 * should begin (on scroll into view, on reveal, on a fetch landing). It is not
 * automatic: every caller here animates in response to an event, not on mount.
 *
 * `start` counts from wherever the value currently is, not from zero. That is
 * a no-op for the callers that begin at 0, and it is the whole behaviour for
 * the landing-page demo, whose score climbs 0 → 78 → 88 across the script and
 * would otherwise drop back to zero before each rise.
 */
export function useCountUp(durationMs = 1200) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);
  // The rAF closure reads the starting point through a ref so that `start`
  // does not have to be re-created (and callers' effects re-run) on every
  // single frame of its own animation.
  const valueRef = useRef(0);

  // Cancel on unmount. Without this a count-up that is still running when the
  // user navigates away calls setState on an unmounted component every frame
  // until it finishes.
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const start = useCallback(
    (target: number) => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      if (prefersReduced || durationMs <= 0) {
        valueRef.current = target;
        setValue(target);
        return;
      }

      const from = valueRef.current;
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        const next = Math.round(from + (target - from) * eased);
        valueRef.current = next;
        setValue(next);
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick);
        } else {
          frameRef.current = null;
        }
      };
      frameRef.current = requestAnimationFrame(tick);
    },
    [durationMs],
  );

  const reset = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    valueRef.current = 0;
    setValue(0);
  }, []);

  return { value, start, reset };
}
