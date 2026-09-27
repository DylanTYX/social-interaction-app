"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Quote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * "It follows up on what you actually said", one step per stretch of scroll:
 * one answer followed through the app — the interview, the move Advanced system
 * state records, the follow-up, and the line the report keeps. Drawn as cards
 * labelled with where each piece appears, not as another interview window: the
 * hero already shows the screen, and this shows what happens behind it.
 *
 * Everything on the interviewer's side is what the app produces for this
 * answer — the detector's marker, the engine's move and its reason, the
 * report's reading — and `follow-up-scroll.test.ts` fails if any of them
 * drifts. Only the follow-up's wording is an example, since a model writes it.
 * The highlight is this page's, marking what the detector matched; the
 * interview itself does not highlight words.
 *
 * Pinned only where that works: a wide, tall screen with motion allowed.
 * Everywhere else, and before hydration, it is an ordinary story showing the
 * finished frame, so a phone or a reduced-motion setting still gets the whole
 * explanation.
 */

const INTERVIEWER = "Maya Kim";

export const FOLLOW_UP_EXAMPLE = {
  question: "Tell me about a time something broke in production.",
  answerBefore: "When our checkout API kept timing out during a sale, I ",
  marker: "helped with",
  answerAfter:
    " the fix. We put a cache in front of pricing and the alerts stopped.",
  strategyLabel: "Testing personal ownership",
  reason:
    'The candidate said "helped with" — quote their word back and ask what they specifically were responsible for.',
  followUp:
    "You said you helped with the fix. Which part of it were you responsible for?",
  score: 58,
  reading: "your personal role is unclear",
} as const;

const STEPS = [
  "You answer the question.",
  "It catches “helped with”, which doesn’t say what you did.",
  "It picks one move, and notes why.",
  "The follow-up quotes your words back.",
  "Your report quotes them too.",
] as const;

/** Where each step begins, as a share of the pinned scroll. The rest is a hold on the finished frame. */
const STEP_STARTS = [0.02, 0.18, 0.36, 0.54, 0.8] as const;
/** The follow-up types across this span, so scrolling drives it rather than a timer. */
const TYPING_SPAN = [0.54, 0.74] as const;

/** Scroll length of the pinned section in viewport heights: about half a screen per step. */
const TRACK_VH = 340;
/** The marketing header: 68px plus its bottom border. */
const NAV_HEIGHT = 69;
const PINNED_QUERY =
  "(min-width: 64rem) and (min-height: 42rem) and (prefers-reduced-motion: no-preference)";

const PANEL_LABEL = "text-xs font-semibold tracking-wide text-slate-500 uppercase";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(PINNED_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function usePinned(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PINNED_QUERY).matches,
    () => false,
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** How far through the pinned stretch the page has scrolled, 0 to 1. */
function useScrollProgress(
  trackRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
): number {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const travel = rect.height - (window.innerHeight - NAV_HEIGHT);
      const next = travel > 0 ? clamp01((NAV_HEIGHT - rect.top) / travel) : 1;
      setProgress((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [trackRef, enabled]);

  return progress;
}

export function FollowUpScroll({
  intro,
}: {
  /** Eyebrow, title and body, drawn by the page so they match its other stories. */
  intro: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pinned = usePinned();
  const progress = useScrollProgress(trackRef, pinned);

  const p = pinned ? progress : 1;
  const active = STEP_STARTS.findLastIndex((start) => p >= start);
  const typedShare = clamp01(
    (p - TYPING_SPAN[0]) / (TYPING_SPAN[1] - TYPING_SPAN[0]),
  );
  const { followUp } = FOLLOW_UP_EXAMPLE;
  const typedChars = Math.round(typedShare * followUp.length);
  /** The card the current step is about, outlined so the eye can follow. */
  const current = (step: number) => pinned && active === step;

  return (
    <div
      ref={trackRef}
      className="relative border-t border-slate-200"
      style={pinned ? { height: `${TRACK_VH}vh` } : undefined}
    >
      <div
        className={cn(pinned && "sticky flex items-center")}
        style={
          pinned
            ? { top: NAV_HEIGHT, height: `calc(100vh - ${NAV_HEIGHT}px)` }
            : undefined
        }
      >
        <div
          className={cn(
            "grid w-full grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16",
            !pinned && "py-8 md:py-12",
          )}
        >
          <div className="flex max-w-[46ch] flex-col gap-3.5">
            {intro}
            <ol className="mt-2 flex flex-col gap-2.5">
              {STEPS.map((text, index) => {
                const state = !pinned
                  ? "done"
                  : index < active
                    ? "done"
                    : index === active
                      ? "active"
                      : "next";
                return (
                  <li
                    key={text}
                    aria-current={state === "active" ? "step" : undefined}
                    className="flex items-start gap-3 text-[15px] leading-snug"
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-150",
                        state === "active" && "bg-primary text-white",
                        state === "done" && "bg-primary-subtle text-primary",
                        state === "next" && "bg-slate-100 text-slate-500",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "pt-0.5 text-pretty transition-colors duration-150",
                        state === "active" && "font-medium text-slate-900",
                        state === "done" && "text-slate-600",
                        state === "next" && "text-slate-500",
                      )}
                    >
                      {text}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="min-w-0">
            <TraceCard where="In the interview" current={current(0) || current(1)}>
              <p className="text-xs leading-relaxed text-slate-500">
                {INTERVIEWER} asked: &ldquo;{FOLLOW_UP_EXAMPLE.question}&rdquo;
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-900">
                {FOLLOW_UP_EXAMPLE.answerBefore}
                <mark
                  className={cn(
                    "-mx-0.5 rounded-[3px] px-0.5 whitespace-nowrap text-inherit transition-[background-color,box-shadow] duration-300 ease-soft",
                    active >= 1
                      ? "bg-warning-muted shadow-[inset_0_-2px_0_var(--color-warning)]"
                      : "bg-transparent",
                  )}
                >
                  {FOLLOW_UP_EXAMPLE.marker}
                </mark>
                {FOLLOW_UP_EXAMPLE.answerAfter}
              </p>
            </TraceCard>

            <Arrow on={active >= 1}>
              Caught &ldquo;{FOLLOW_UP_EXAMPLE.marker}&rdquo;
            </Arrow>
            <Shown on={active >= 2}>
              <TraceCard where="In Advanced system state" current={current(2)}>
                <p className={PANEL_LABEL}>The move it chose last</p>
                <p className="mt-1.5 font-display text-base font-semibold tracking-tight text-slate-900">
                  {FOLLOW_UP_EXAMPLE.strategyLabel}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-pretty text-slate-600">
                  {FOLLOW_UP_EXAMPLE.reason}
                </p>
              </TraceCard>
            </Shown>

            <Arrow on={active >= 3}>Asked next</Arrow>
            <Shown on={active >= 3}>
              <TraceCard where="In the interview" current={current(3)}>
                <p className="text-xs font-medium text-slate-500">
                  {INTERVIEWER}
                </p>
                {/* The full text holds the card at its final size while the
                    typed part grows over it, so nothing below it moves. */}
                <p className="mt-1 text-sm leading-relaxed text-slate-900">
                  <span className="sr-only">{followUp}</span>
                  <span className="grid" aria-hidden="true">
                    <span className="invisible col-start-1 row-start-1">
                      {followUp}
                    </span>
                    <span className="col-start-1 row-start-1">
                      {followUp.slice(0, typedChars)}
                      {pinned && typedChars < followUp.length && (
                        <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-caret bg-current align-text-bottom" />
                      )}
                    </span>
                  </span>
                </p>
              </TraceCard>
            </Shown>

            <Arrow on={active >= 4}>Kept in your report</Arrow>
            <Shown on={active >= 4}>
              <TraceCard where="In your report" current={current(4)}>
                <div className="flex items-center gap-2">
                  <Badge variant="warning" className="font-semibold tabular-nums">
                    {FOLLOW_UP_EXAMPLE.score}%
                  </Badge>
                  <span className="text-xs text-slate-500">this answer</span>
                </div>
                <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-slate-500">
                  <Quote className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    &ldquo;{FOLLOW_UP_EXAMPLE.marker}&rdquo; —{" "}
                    {FOLLOW_UP_EXAMPLE.reading}
                  </span>
                </p>
              </TraceCard>
            </Shown>
          </div>
        </div>
      </div>
    </div>
  );
}

function Shown({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "transition-[opacity,transform] duration-500 ease-soft",
        on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      {children}
    </div>
  );
}

/** One place in the app, named in the page's mock-header style. */
function TraceCard({
  where,
  current,
  children,
}: {
  where: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white px-4 py-2.5 shadow-soft transition-colors duration-150",
        current ? "border-primary" : "border-slate-200",
      )}
    >
      <p className="mb-1 text-[12.5px] text-slate-500">{where}</p>
      {children}
    </div>
  );
}

/** The page's labelled arrow between a cause and what it led to. */
function Arrow({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "my-1.5 flex items-center gap-2.5 text-[12.5px] font-semibold text-primary transition-opacity duration-500 ease-soft",
        on ? "opacity-100" : "opacity-0",
      )}
    >
      <span aria-hidden="true">↓</span>
      <span>{children}</span>
      <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
    </div>
  );
}
