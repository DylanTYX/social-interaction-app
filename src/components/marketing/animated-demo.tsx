"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Sparkles } from "lucide-react";

import { useCountUp } from "@/hooks/use-count-up";

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
      "Let's start simple — tell me about a time you led a project under a tight deadline.",
  },
  {
    role: "user",
    content:
      "We had two weeks to ship a checkout redesign. I scoped it down to the highest-impact changes, split the work across three engineers, and shipped on time with a 12% conversion lift.",
    score: 78,
    note: "Strong: clear result, quantified impact",
  },
  {
    role: "ai",
    content:
      "Nice — what was the hardest trade-off you had to make to hit that date?",
  },
  {
    role: "user",
    content:
      "I cut the saved-cards feature. I weighed it against the redesign's reach, validated with the data, and logged it as fast-follow so we didn't lose it.",
    score: 88,
    note: "Great: shows reasoning and ownership",
  },
];

const TYPING_SPEED_MS = 22;
const PAUSE_AFTER_MESSAGE_MS = 700;
const LOOP_RESTART_MS = 2600;

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
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-soft-lg">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-linear-to-r from-blue-50 to-indigo-50/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <Mic className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-800">
            Behavioral round · live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Live score</span>
          <span
            className={`flex h-9 min-w-[3rem] items-center justify-center rounded-lg px-2 text-lg font-bold tabular-nums transition-colors ${
              score >= 80
                ? "bg-emerald-100 text-emerald-700"
                : score >= 60
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {score}
          </span>
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="flex h-96 flex-col gap-3 overflow-y-auto scroll-smooth p-5"
      >
        {completed.map((turn, index) => (
          <DemoBubble key={`done-${index}`} turn={turn} />
        ))}
        {partial && (
          <DemoBubble turn={{ ...typingTurn, content: partial }} typing />
        )}
      </div>
    </div>
  );
}

function DemoBubble({ turn, typing }: { turn: DemoTurn; typing?: boolean }) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-soft ${
          isUser
            ? "rounded-tr-sm bg-blue-600 text-white"
            : "rounded-tl-sm border border-gray-200/80 bg-gray-50 text-gray-800"
        }`}
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
      {isUser && !typing && turn.note && (
        <p className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <Sparkles className="h-3 w-3" />
          {turn.note}
        </p>
      )}
    </div>
  );
}
