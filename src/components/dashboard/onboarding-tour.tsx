"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { isOnboardingComplete, START_TOUR_EVENT } from "@/lib/onboarding";

const TOUR_STORAGE_KEY = "convotrainer.tourDone";

interface TourStep {
  target: string;
  title: string;
  body: string;
}

/**
 * The page first, top to bottom, then the sidebar, top to bottom, so the
 * spotlight never jumps back up the screen it just came down.
 *
 * Each step names a thing you will use and what you get from it. It used to
 * open on the whole sidebar with "Everything lives here", which pointed at
 * nine links and explained none of them.
 */
const STEPS: TourStep[] = [
  {
    target: "new-interview",
    title: "Start an interview",
    body: "Describe the role, pick your rounds and an interviewer, then answer out loud. Every answer is scored.",
  },
  {
    target: "next-step",
    title: "Your next step",
    body: "A suggestion for what to practise next. If you leave an interview unfinished, you resume it from here.",
  },
  {
    target: "progress",
    title: "See whether you're improving",
    body: "Your numbers at a glance. Analytics breaks them down by round type and says what to practise next.",
  },
  {
    target: "goals",
    title: "Set a weekly goal",
    body: "Choose how many sessions to aim for each week. The strip shows the days you practised.",
  },
  {
    target: "drills",
    title: "Warm up with a quick drill",
    body: "One question, a short answer and instant feedback, spoken or typed. It takes a couple of minutes.",
  },
  {
    target: "library",
    title: "Save your documents once",
    body: "Add job descriptions, resumes and interviewers here, then pick them when you set up an interview.",
  },
  {
    target: "search",
    title: "Jump anywhere with ⌘K",
    body: "Press ⌘K, or click here, to open any page or start an interview without clicking around.",
  },
];

const selectorFor = (step: TourStep) => `[data-tour="${step.target}"]`;

/** The first match that is actually laid out; a hidden copy measures 0×0. */
function findTarget(step: TourStep): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(selectorFor(step));
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return node;
  }
  return null;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_WIDTH = 340;
/** Space between the target and the outline drawn around it. */
const PAD = 6;
/** The outline is 4px wide (2px white, 2px blue); keep it all on screen. */
const EDGE = 6;
const GAP = 16;

/**
 * A spotlight walkthrough of the dashboard.
 *
 * Runs once, on screens wide enough for the sidebar, after the goal picker.
 * "Take the tour" in Tips & guides and the command palette runs it again.
 *
 * The outline is drawn in the same `box-shadow` as the dimmed backdrop. It was
 * a Tailwind `ring`, which is also a box-shadow, so the inline backdrop shadow
 * replaced it and no outline was ever drawn. On the white page the dimming
 * alone marked the target; on the navy sidebar dimmed navy looks like navy, so
 * the sidebar steps highlighted nothing. White then blue reads on both grounds.
 */
export function OnboardingTour() {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(200);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * Waits for the targets rather than guessing a delay. The weekly goal card
   * renders only once sessions load, and a tour that started before it would
   * silently lose that step.
   */
  const start = useCallback(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const startedAt = Date.now();
    const poll = () => {
      const allThere = STEPS.every((step) => findTarget(step));
      if (!allThere && Date.now() - startedAt < 5000) {
        window.setTimeout(poll, 250);
        return;
      }
      const available = STEPS.filter((step) => findTarget(step));
      if (available.length === 0) return;
      setStepIndex(0);
      setSteps(available);
    };
    window.setTimeout(poll, 400);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tour") === "1";
    if (requested) {
      // Drop the flag so a refresh does not run the tour again.
      params.delete("tour");
      const query = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
    }

    let alreadyDone = false;
    try {
      alreadyDone = Boolean(window.localStorage.getItem(TOUR_STORAGE_KEY));
    } catch {
      alreadyDone = true;
    }

    // A brand-new user sees the goal picker first. Its "Skip for now" starts
    // the tour; picking a goal goes to setup, and the tour runs on return.
    if (requested || (!alreadyDone && isOnboardingComplete())) start();

    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, [start]);

  const active = steps !== null;
  const step = steps?.[stepIndex] ?? null;

  const measure = useCallback(() => {
    const node = step ? findTarget(step) : null;
    if (!node) {
      setBox(null);
      return;
    }
    const rect = node.getBoundingClientRect();
    const left = Math.max(EDGE, rect.left - PAD);
    const top = Math.max(EDGE, rect.top - PAD);
    const right = Math.min(window.innerWidth - EDGE, rect.right + PAD);
    const bottom = Math.min(window.innerHeight - EDGE, rect.bottom + PAD);
    setBox({ top, left, width: right - left, height: bottom - top });
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    const node = findTarget(step);
    // Only scroll when the target is not already fully in view, so the
    // sidebar steps do not nudge the page.
    if (node) {
      const rect = node.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    const raf = requestAnimationFrame(measure);
    const observer = node ? new ResizeObserver(measure) : null;
    if (node) observer?.observe(node);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  // The tooltip is placed from its real height, which changes with the copy.
  useLayoutEffect(() => {
    if (!step) return;
    const height = tooltipRef.current?.offsetHeight;
    if (height && height !== tooltipHeight) setTooltipHeight(height);
  }, [step, tooltipHeight]);

  useEffect(() => {
    if (active) nextButtonRef.current?.focus();
  }, [active, stepIndex]);

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_STORAGE_KEY, "1");
    } catch {
      // Private mode: the tour simply offers itself again next time.
    }
    setSteps(null);
    setBox(null);
  }, []);

  const count = steps?.length ?? 0;
  const isLast = stepIndex >= count - 1;

  const next = useCallback(() => {
    if (isLast) finish();
    else setStepIndex((index) => index + 1);
  }, [isLast, finish]);

  const back = useCallback(() => {
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, next, back, finish]);

  if (!step) return null;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const clampTop = (top: number) =>
    Math.min(Math.max(GAP, top), viewportHeight - tooltipHeight - GAP);
  const clampLeft = (left: number) =>
    Math.min(Math.max(GAP, left), viewportWidth - TOOLTIP_WIDTH - GAP);

  /**
   * Beside a target at the left edge, so a sidebar step does not cover the
   * links under it. Otherwise below, or above when below would run off screen.
   */
  let tooltipTop = viewportHeight / 2 - tooltipHeight / 2;
  let tooltipLeft = viewportWidth / 2 - TOOLTIP_WIDTH / 2;
  if (box) {
    const right = box.left + box.width;
    const fitsBeside = right + GAP + TOOLTIP_WIDTH <= viewportWidth - GAP;
    if (box.left < viewportWidth / 3 && fitsBeside) {
      tooltipLeft = right + GAP;
      tooltipTop = clampTop(box.top);
    } else {
      const below = box.top + box.height + GAP;
      tooltipTop =
        below + tooltipHeight <= viewportHeight - GAP
          ? below
          : clampTop(box.top - GAP - tooltipHeight);
      tooltipLeft = clampLeft(box.left);
    }
  }

  return (
    <div className="fixed inset-0 z-60">
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl transition-all duration-300 ease-soft"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow:
              "0 0 0 2px #fff, 0 0 0 4px var(--primary), 0 0 0 9999px rgb(14 26 58 / 0.6)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-navy/60" />
      )}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute rounded-xl border border-slate-200 bg-white p-4 shadow-soft-lg transition-[top,left] duration-300 ease-soft"
        style={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_WIDTH }}
      >
        <p className="text-xs font-medium text-slate-500 tabular-nums">
          {stepIndex + 1} of {count}
        </p>
        <h2
          id="tour-title"
          className="mt-1 font-display text-lg font-semibold tracking-tight text-slate-900"
        >
          {step.title}
        </h2>
        <p
          id="tour-body"
          className="mt-1 text-sm leading-relaxed text-slate-600"
        >
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="outline" size="sm" onClick={back}>
                Back
              </Button>
            )}
            <Button ref={nextButtonRef} size="sm" onClick={next}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
