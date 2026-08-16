"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isOnboardingComplete } from "@/lib/onboarding";

const TOUR_STORAGE_KEY = "convotrainer.tourDone";

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="nav"]',
    title: "Everything lives here",
    body: "Start an interview, run quick drills, review sessions, and track analytics — all from the sidebar.",
  },
  {
    selector: '[data-tour="search"]',
    title: "Jump anywhere with ⌘K",
    body: "Press ⌘K (or click here) to navigate or start practicing instantly, without clicking around.",
  },
  {
    selector: '[data-tour="goals"]',
    title: "Build a streak",
    body: "Set a weekly goal and keep your streak alive. Consistent reps are what move your scores.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Decide whether to run the tour: once, on desktop, when targets exist.
  useEffect(() => {
    if (window.localStorage.getItem(TOUR_STORAGE_KEY)) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    // Let brand-new users finish the goal picker first; the tour shows on a
    // later visit once onboarding is marked complete.
    if (!isOnboardingComplete()) return;

    const timer = window.setTimeout(() => {
      const hasTargets = STEPS.some((step) =>
        document.querySelector(step.selector),
      );
      if (hasTargets) setActive(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  const measure = useCallback(() => {
    const step = STEPS[stepIndex];
    const node = step
      ? (document.querySelector(step.selector) as HTMLElement | null)
      : null;
    if (!node) {
      setRect(null);
      return;
    }
    const r = node.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [stepIndex]);

  useLayoutEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, measure]);

  // Bring the current target into view when the step changes. The scroll
  // listener above keeps the spotlight aligned as the page scrolls, so a target
  // below the fold (e.g. the goals card) is no longer clipped.
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIndex];
    const node = step
      ? (document.querySelector(step.selector) as HTMLElement | null)
      : null;
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, stepIndex]);

  const finish = useCallback(() => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "1");
    setActive(false);
  }, []);

  const next = () => {
    if (stepIndex >= STEPS.length - 1) {
      finish();
    } else {
      setStepIndex((index) => index + 1);
    }
  };

  if (!active) return null;

  const pad = 8;
  const highlight = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Place the tooltip below the highlight, or above if it would overflow.
  const tooltipWidth = 320;
  let tooltipTop = highlight ? highlight.top + highlight.height + 12 : 120;
  const wouldOverflow = highlight && tooltipTop + 180 > window.innerHeight;
  if (highlight && wouldOverflow) {
    tooltipTop = Math.max(16, highlight.top - 188);
  }
  const tooltipLeft = highlight
    ? Math.min(
        Math.max(16, highlight.left),
        window.innerWidth - tooltipWidth - 16,
      )
    : window.innerWidth / 2 - tooltipWidth / 2;

  const step = STEPS[stepIndex];

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Spotlight: a transparent box with a huge shadow dims everything else. */}
      {highlight ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/55" />
      )}

      {/* Tooltip card */}
      <div
        className="absolute rounded-xl border border-slate-200 bg-white p-4 shadow-soft-lg"
        style={{ top: tooltipTop, left: tooltipLeft, width: tooltipWidth }}
      >
        <p className="text-sm font-semibold text-slate-900">{step.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === stepIndex ? "w-5 bg-primary" : "w-1.5 bg-slate-300"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={finish}>
              Skip
            </Button>
            <Button size="sm" onClick={next}>
              {stepIndex >= STEPS.length - 1 ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
