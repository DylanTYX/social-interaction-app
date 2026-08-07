"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Delay (ms) before the reveal transition starts, for staggered groups. */
  delay?: number;
  as?: "div" | "section" | "li";
}

/**
 * Wraps content so it fades/slides into view the first time it scrolls into
 * the viewport. Uses a single IntersectionObserver per instance and unobserves
 * after the first reveal so it never re-hides. Falls back to visible if
 * IntersectionObserver is unavailable.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      // Fallback for environments without IO: reveal on next tick so we don't
      // call setState synchronously inside the effect body.
      const id = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      className={cn(
        // The old `.reveal` / `.reveal-visible` pair, as utilities. Every
        // declaration it carried has an equivalent: the 0.6s duration and the
        // easing curve as arbitrary values, and `motion-reduce:` doing the job
        // the `prefers-reduced-motion` media query used to do by hand.
        "transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,transform]",
        "motion-reduce:transition-none",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-6 motion-reduce:opacity-100 motion-reduce:translate-y-0",
        className,
      )}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
