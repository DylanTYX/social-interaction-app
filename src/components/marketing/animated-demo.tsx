"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

import { useCountUp } from "@/hooks/use-count-up";
import { TILE_COLORS } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

type DemoTurn = {
  role: "ai" | "user";
  content: string;
  /** Score the live meter animates to after this user answer. */
  score?: number;
  /** Micro-feedback chip shown under a user answer. */
  note?: string;
};

// A short, realistic interview exchange that loops. The candidate answers
// improve, so the live score visibly climbs — the whole point of the product.
const SCRIPT: DemoTurn[] = [
  {
    role: "ai",
    content:
      "Let's start simple. Tell me about a time you led a project under a tight deadline.",
  },
  {
    role: "user",
    content:
      "We had two weeks to ship a checkout redesign. I scoped it down to the highest-impact changes, split the work across three engineers, and shipped on time with a 12% conversion lift.",
    score: 78,
    note: "Clear result, quantified impact",
  },
  {
    role: "ai",
    content:
      "Nice. What was the hardest trade-off you had to make to hit that date?",
  },
  {
    role: "user",
    content:
      "I cut the saved-cards feature. I weighed it against the redesign's reach, validated with the data, and logged it as a fast-follow so we didn't lose it.",
    score: 88,
    note: "Shows reasoning and ownership",
  },
];

/** What the scoring rail shows for this round: the STAR rubric, as marked. */
const RUBRIC = [
  { label: "Situation", score: 9 },
  { label: "Task", score: 8 },
  { label: "Action", score: 9 },
  { label: "Result", score: 8 },
] as const;

const TYPING_SPEED_MS = 22;
const PAUSE_AFTER_MESSAGE_MS = 700;
const LOOP_RESTART_MS = 2600;

/**
 * The interview screen, as a looping demo: a transcript that types itself, a
 * live score that climbs, and the rubric the round is scored against. It is
 * the landing page's proof, so it sits in the hero at full width.
 */
export function AnimatedDemo() {
  const [completed, setCompleted] = useState<DemoTurn[]>([]);
  const [typingIndex, setTypingIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // `useCountUp` counts from wherever it currently sits, which is what makes
  // the meter climb 0 → 78 → 88 across the script rather than restarting.
  const {
    value: score,
    start: animateScore,
    reset: resetScore,
  } = useCountUp(700);

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
      setCompleted([]);
      setTypingIndex(0);
      setTypedChars(0);
      resetScore();
      schedule(() => typeMessage(0), 400);
    };

    const typeMessage = (index: number) => {
      if (index >= SCRIPT.length) {
        schedule(reset, LOOP_RESTART_MS);
        return;
      }
      const turn = SCRIPT[index];
      setTypingIndex(index);
      setTypedChars(0);

      if (prefersReduced) {
        // Skip the character animation; just reveal each message in sequence.
        setTypedChars(turn.content.length);
        schedule(() => finishMessage(index, turn), PAUSE_AFTER_MESSAGE_MS);
        return;
      }

      let chars = 0;
      const step = () => {
        chars += 2;
        setTypedChars(chars);
        if (chars < turn.content.length) {
          schedule(step, TYPING_SPEED_MS);
        } else {
          setTypedChars(turn.content.length);
          schedule(() => finishMessage(index, turn), PAUSE_AFTER_MESSAGE_MS);
        }
      };
      step();
    };

    const finishMessage = (index: number, turn: DemoTurn) => {
      setCompleted((prev) => [...prev, turn]);
      if (typeof turn.score === "number") {
        animateScore(turn.score);
      }
      typeMessage(index + 1);
    };

    reset();

    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // Intentionally set up once. `animateScore` and `resetScore` are stable
    // for the life of the component, so listing them does not restart the loop.
  }, [animateScore, resetScore]);

  const typingTurn = SCRIPT[typingIndex];
  const partial =
    typingTurn && completed.length === typingIndex
      ? typingTurn.content.slice(0, typedChars)
      : "";

  // Keep the newest message in view as it types and as turns accumulate, so the
  // conversation reads like a live chat instead of clipping at the bottom.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [completed, typedChars]);

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
        <span
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold tabular-nums transition-colors duration-300",
            score >= 80
              ? "bg-success-subtle text-success-emphasis"
              : score >= 60
                ? "bg-primary-subtle text-primary-emphasis"
                : "bg-slate-100 text-slate-600",
          )}
        >
          Live score <b className="text-[15px]">{score}</b>
        </span>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_248px]">
        <div
          ref={scrollRef}
          className="flex h-75 flex-col gap-3.5 overflow-y-auto scroll-smooth p-5 md:h-95"
        >
          {completed.map((turn, index) => (
            <DemoBubble key={`done-${index}`} turn={turn} />
          ))}
          {partial && (
            <DemoBubble turn={{ ...typingTurn, content: partial }} typing />
          )}
        </div>

        <aside className="hidden flex-col gap-4 border-l border-slate-100 px-5 py-5.5 md:flex">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            This round scores
          </h4>
          <div className="flex flex-col gap-3.5">
            {RUBRIC.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[64px_1fr_22px] items-center gap-2.5 text-[13px] text-slate-600"
              >
                <span>{row.label}</span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${row.score * 10}%` }}
                  />
                </span>
                <span className="text-right font-semibold text-slate-900 tabular-nums">
                  {row.score}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="flex items-center gap-2.5 border-t border-slate-100 px-4 py-3">
        <div className="flex h-9.5 flex-1 items-center rounded-[10px] border border-slate-200 px-3 text-[13.5px] text-slate-500">
          Type your answer, or hold to speak…
        </div>
        <span
          className="inline-flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-[10px] bg-slate-900 text-white"
          aria-hidden="true"
        >
          <Mic className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function DemoBubble({ turn, typing }: { turn: DemoTurn; typing?: boolean }) {
  const isUser = turn.role === "user";
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
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
            isUser ? "bg-primary" : "bg-navy",
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
            {turn.content}
          </span>
        </div>
      </div>
      {isUser && !typing && turn.note && (
        <p className="mt-1.5 rounded-md bg-success-subtle px-2.5 py-1 text-xs font-medium text-success-emphasis">
          {turn.note}
        </p>
      )}
    </div>
  );
}
