"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { TILE_ACCENT, TILE_COLORS, tileColorForKey } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

/** The interviewer in the demo, whose initials and colour come from this. */
const INTERVIEWER = "Maya Kim";

/**
 * What the analyzer is taken to have returned for one answer, and what the
 * interview screen shows for it. The reading is the example; everything shown
 * is what the app computes from it — the chip under the answer and the four
 * live coaching measures — and `animated-demo.test.ts` fails if they drift.
 */
export type DemoReading = {
  overallScore: number;
  strengths: string[];
  gaps: string[];
  assertivenessScore: number;
  isRelevant: boolean;
  vaguenessScore: number;
  actionSpecificity: number;
  resultQuantified: boolean;
  hesitationMarkers: number;
  hint: string;
  tone: "positive" | "constructive" | "neutral";
  /** The rail after this answer, in `MEASURES` order. */
  measures: [number, number, number, number];
  /** This answer's point on each measure's sparkline, in `MEASURES` order. */
  points: [number, number, number, number];
  /** "Notes on your last answer" after this one. */
  notes: DemoNote[];
};

export type DemoNote = { title: string; body: string; tone: "good" | "warn" | "focus" };

/** What the rail lists before the first answer is scored. */
export const NOTES_BEFORE_ANSWERS: DemoNote[] = [
  {
    title: "Start with concrete context",
    body: "Open with situation + task in 1-2 lines before describing your action.",
    tone: "focus",
  },
  {
    title: "Use STAR pacing",
    body: "Keep the answer structured and avoid jumping straight to outcomes.",
    tone: "good",
  },
];

const STRONG_NOTE: DemoNote = {
  title: "Great structure",
  body: "Strong answer. Keep this level of specificity while tightening conciseness.",
  tone: "good",
};

export type DemoTurn =
  | { role: "ai"; content: string }
  | { role: "user"; content: string; reading: DemoReading };

/** The live coaching rail's four measures in a text interview, as it labels them. */
export const MEASURES = [
  { label: "Confidence", unit: "%" },
  { label: "Relevance", unit: "%" },
  { label: "Answer length", unit: "words" },
  { label: "Conciseness", unit: "%" },
] as const;

// A short, realistic exchange that loops. The second question quotes the first
// answer back, and the second answer is the stronger one, so the rail climbs.
export const SCRIPT: DemoTurn[] = [
  {
    role: "ai",
    content:
      "Let's start simple. Tell me about a time you led a project under a tight deadline.",
  },
  {
    role: "user",
    content:
      "We had two weeks to ship a checkout redesign before a holiday sale. I cut the scope to the three changes that mattered most and dropped two nice-to-haves. We shipped a day early, and conversion rose 12%.",
    reading: {
      overallScore: 78,
      strengths: ["Clear result with a number"],
      gaps: ["Say how you chose what to cut"],
      assertivenessScore: 7.5,
      isRelevant: true,
      vaguenessScore: 3,
      actionSpecificity: 7,
      resultQuantified: true,
      hesitationMarkers: 1,
      hint: "Clear result with a number — next, say how you chose what to cut.",
      tone: "positive",
      measures: [75, 90, 37, 70],
      points: [75, 90, 18.5, 70],
      notes: [STRONG_NOTE],
    },
  },
  {
    role: "ai",
    content:
      "You said you dropped two nice-to-haves. How did you decide which two?",
  },
  {
    role: "user",
    content:
      "I ranked what was left by reach and effort. Saved cards would reach under 10% of the sale's buyers, and gift wrapping cost the most for the least. I checked both numbers with our analyst first.",
    reading: {
      overallScore: 86,
      strengths: [
        "Shows the reasoning behind the cut, and that you checked the numbers",
      ],
      gaps: [],
      assertivenessScore: 8.5,
      isRelevant: true,
      vaguenessScore: 2,
      actionSpecificity: 8,
      resultQuantified: true,
      hesitationMarkers: 0,
      hint: "Shows the reasoning behind the cut, and that you checked the numbers.",
      tone: "positive",
      measures: [80, 90, 36, 80],
      points: [85, 90, 18, 80],
      notes: [STRONG_NOTE],
    },
  },
];

/** For each turn, which answer it is, counting from 0; -1 for the interviewer's. */
const ANSWER_INDEX = SCRIPT.map((turn, index) =>
  turn.role === "user"
    ? SCRIPT.slice(0, index).filter((earlier) => earlier.role === "user").length
    : -1,
);

/** The interview header's question count, as `Question n of ~6`. */
const TARGET_QUESTIONS = 6;

const TYPING_SPEED_MS = 22;
const PAUSE_AFTER_MESSAGE_MS = 700;
/** How long "Coach is reviewing your answer…" shows before the chip settles. */
const REVIEW_MS = 1100;
const PAUSE_AFTER_SCORE_MS = 1500;
const LOOP_RESTART_MS = 3200;

/** The rail's note marks: green is good, amber needs attention, a focus is neutral. */
const NOTE_MARK: Record<DemoNote["tone"], string> = {
  good: "bg-success",
  warn: "bg-warning",
  focus: "bg-slate-300",
};

/** The same tones the interview screen gives the chip under an answer. */
const CHIP_TONE: Record<DemoReading["tone"], string> = {
  positive: "border-success-border bg-success-subtle text-success-emphasis",
  constructive: "border-warning-border bg-warning-subtle text-warning-emphasis",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

/**
 * The text interview screen, as a looping demo: the interviewer's questions
 * stream in, each answer is sent whole, the coach reviews it, and the chip
 * under it and the live coaching rail update — the screen as it behaves,
 * including a follow-up that quotes the answer before it.
 */
export function AnimatedDemo() {
  const [shown, setShown] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [scored, setScored] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let cancelled = false;
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.current.push(id);
    };

    const reset = () => {
      setShown(0);
      setTypedChars(0);
      setScored(0);
      schedule(() => play(0, 0), 400);
    };

    /** `index` is the turn to show next; `answers` how many answers are scored. */
    const play = (index: number, answers: number) => {
      if (index >= SCRIPT.length) {
        schedule(reset, LOOP_RESTART_MS);
        return;
      }
      const turn = SCRIPT[index];

      if (turn.role === "user") {
        // Sent whole, as the composer sends it, then reviewed.
        setShown(index + 1);
        schedule(() => {
          setScored(answers + 1);
          schedule(() => play(index + 1, answers + 1), PAUSE_AFTER_SCORE_MS);
        }, REVIEW_MS);
        return;
      }

      // The interviewer's reply streams in.
      setTypedChars(0);
      setShown(index + 1);
      if (prefersReduced) {
        setTypedChars(turn.content.length);
        schedule(() => play(index + 1, answers), PAUSE_AFTER_MESSAGE_MS);
        return;
      }
      let chars = 0;
      const step = () => {
        chars += 2;
        setTypedChars(Math.min(chars, turn.content.length));
        if (chars < turn.content.length) {
          schedule(step, TYPING_SPEED_MS);
        } else {
          schedule(() => play(index + 1, answers), PAUSE_AFTER_MESSAGE_MS);
        }
      };
      step();
    };

    reset();

    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const readings = SCRIPT.flatMap((turn) =>
    turn.role === "user" ? [turn.reading] : [],
  );
  const scoredReadings = readings.slice(0, scored);
  const latest = scoredReadings.at(-1);

  // Keep the newest message in view as it streams and as turns accumulate, so
  // the conversation reads like a live chat instead of clipping at the bottom.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [shown, typedChars, scored]);

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-soft-lg"
      aria-label="The interview screen"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5 text-[13.5px] font-medium text-slate-900">
          <span
            className={cn(
              "inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-semibold",
              TILE_COLORS.purple,
            )}
          >
            Behavioral
          </span>
          <span className="truncate font-normal text-slate-500">
            Senior Product Engineer · Acme
          </span>
        </div>
        <span className="inline-flex h-6 shrink-0 items-center rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 tabular-nums">
          Question {Math.min(scored + 1, TARGET_QUESTIONS)} of ~
          {TARGET_QUESTIONS}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_368px]">
        <div
          ref={scrollRef}
          className="flex h-75 flex-col gap-3.5 overflow-y-auto scroll-smooth p-5 md:h-95"
        >
          {SCRIPT.slice(0, shown).map((turn, index) => {
            const isLast = index === shown - 1;
            if (turn.role === "ai") {
              const streaming = isLast && typedChars < turn.content.length;
              return (
                <DemoBubble
                  key={index}
                  from="interviewer"
                  content={isLast ? turn.content.slice(0, typedChars) : turn.content}
                  typing={streaming}
                />
              );
            }
            const settled = ANSWER_INDEX[index] < scored;
            return (
              <DemoBubble key={index} from="you" content={turn.content}>
                <p
                  key={settled ? "settled" : "pending"}
                  className={cn(
                    "mt-1.5 max-w-full rounded-lg border px-3 py-1.5 text-xs leading-relaxed",
                    settled
                      ? cn(
                          "animate-in fade-in-0 slide-in-from-top-1 duration-200",
                          CHIP_TONE[turn.reading.tone],
                        )
                      : "border-slate-200 bg-slate-50 text-slate-500",
                  )}
                >
                  {settled ? (
                    turn.reading.hint
                  ) : (
                    <>
                      <Loader2
                        className="mr-1.5 inline h-3 w-3 animate-spin text-primary"
                        aria-hidden
                      />
                      Coach is reviewing your answer…
                    </>
                  )}
                </p>
              </DemoBubble>
            );
          })}
        </div>

        <aside className="hidden flex-col border-l border-slate-100 md:flex">
          <div className="border-b border-slate-100 px-4 py-3.5">
            <h4 className="font-display text-base font-semibold tracking-tight text-slate-900">
              Live coaching
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Notes appear after each answer.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100">
            {MEASURES.map(({ label, unit }, index) => {
              const value = latest ? latest.measures[index] : null;
              const trend = scoredReadings.map((reading) => reading.points[index]);
              return (
                <div key={label} className="bg-white p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="font-display text-base font-semibold whitespace-nowrap text-navy tabular-nums">
                      {value === null
                        ? "—"
                        : unit === "%"
                          ? `${value}%`
                          : `${value} ${unit}`}
                    </span>
                  </div>
                  {value === null ? (
                    <p className="mt-2 h-7 text-[11px] leading-7 text-slate-400">
                      No answers yet
                    </p>
                  ) : (
                    <Sparkline values={trend} label={label} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="px-4 pt-3.5 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Notes on your last answer
          </p>
          <ul className="divide-y divide-slate-100">
            {(latest ? latest.notes : NOTES_BEFORE_ANSWERS).map((note) => (
              <li key={note.title} className="px-4 py-2.5">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-[2px]", NOTE_MARK[note.tone])}
                    aria-hidden
                  />
                  {note.title}
                </p>
                <p className="mt-1 pl-4 text-xs leading-5 text-slate-600">
                  {note.body}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="flex items-end gap-2.5 border-t border-slate-100 px-4 py-3">
        <div className="flex h-11 flex-1 items-center rounded-md border border-slate-200 px-3 text-[13.5px] text-slate-500">
          Your answer…
        </div>
        <span
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-white"
          aria-hidden="true"
        >
          <Send className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

/** The rail's sparkline, drawn to the same 84 × 26 box. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const width = 84;
  const height = 26;
  const stepX = values.length === 1 ? 0 : width / (values.length - 1);
  const path = values
    .map((value, index) => {
      const y = height - (Math.min(100, Math.max(0, value)) / 100) * height;
      return `${index === 0 ? "M" : "L"}${(index * stepX).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-2 h-7 w-full text-primary"
      role="img"
      aria-label={`${label} trend`}
    >
      {[0, 13, 26].map((y) => (
        <line
          key={y}
          x1="0"
          y1={y}
          x2={width}
          y2={y}
          className="stroke-slate-100"
          strokeWidth="1"
        />
      ))}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DemoBubble({
  from,
  content,
  typing = false,
  children,
}: {
  from: "interviewer" | "you";
  content: string;
  typing?: boolean;
  children?: React.ReactNode;
}) {
  const isUser = from === "you";
  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "flex max-w-[92%] items-start gap-2.5",
          isUser && "flex-row-reverse",
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-semibold text-white",
            // The interviewer wears their identity colour, as every person
            // does inside the app; the candidate is blue, matching the bubble.
            isUser ? "bg-primary" : TILE_ACCENT[tileColorForKey(INTERVIEWER)],
          )}
          aria-hidden="true"
        >
          {isUser ? "You" : "MK"}
        </span>
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed shadow-soft",
            isUser
              ? "rounded-tr-sm bg-primary text-white"
              : "rounded-tl-sm bg-slate-50 text-slate-900",
          )}
        >
          <span
            className={
              typing
                ? "after:ml-0.5 after:inline-block after:h-[1em] after:w-0.5 after:animate-caret after:bg-current after:align-text-bottom after:content-[''] motion-reduce:after:animate-none"
                : undefined
            }
          >
            {content}
          </span>
        </div>
      </div>
      {children && (
        <div className={cn("flex max-w-[92%]", isUser ? "pr-9.5" : "pl-9.5")}>
          {children}
        </div>
      )}
    </div>
  );
}
