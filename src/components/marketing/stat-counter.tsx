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
 *
 * The number is set in the display face in navy, the same treatment as every
 * large figure on the landing page; see docs/DESIGN.md.
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
    <div ref={ref} className="flex flex-col items-center gap-1.5 text-center">
      <p className="font-display text-[clamp(1.9rem,2.6vw,2.4rem)] font-bold leading-none tracking-[-0.03em] text-navy tabular-nums">
        {display}
        {suffix}
      </p>
      <p className="text-[14.5px] text-slate-600">{label}</p>
    </div>
  );
}
