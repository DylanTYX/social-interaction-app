"use client";

import { useEffect, useRef, useState } from "react";

interface StatCounterProps {
  value: number;
  label: string;
  suffix?: string;
  durationMs?: number;
}

/**
 * Counts up from 0 to `value` the first time it scrolls into view. Uses
 * requestAnimationFrame with an ease-out curve so the number decelerates as it
 * lands. Respects prefers-reduced-motion by snapping straight to the value.
 */
export function StatCounter({
  value,
  label,
  suffix = "",
  durationMs = 1200,
}: StatCounterProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const run = () => {
      if (startedRef.current) return;
      startedRef.current = true;

      if (prefersReduced) {
        setDisplay(value);
        return;
      }

      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === "undefined") {
      run();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return (
    <div ref={ref}>
      <p className="text-3xl font-bold text-gray-900">
        {display}
        {suffix}
      </p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}
