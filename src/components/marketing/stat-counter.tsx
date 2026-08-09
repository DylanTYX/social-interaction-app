"use client";

import { useEffect, useRef } from "react";

import { useCountUp } from "@/hooks/use-count-up";

interface StatCounterProps {
  value: number;
  label: string;
  suffix?: string;
  durationMs?: number;
}

/**
 * Counts up from 0 to `value` the first time it scrolls into view. The count
 * itself — rAF, ease-out, reduced-motion handling — lives in `useCountUp`;
 * what's left here is the "first time it scrolls into view" part.
 */
export function StatCounter({
  value,
  label,
  suffix = "",
  durationMs = 1200,
}: StatCounterProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const { value: display, start } = useCountUp(durationMs);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const run = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      start(value);
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
  }, [value, start]);

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
