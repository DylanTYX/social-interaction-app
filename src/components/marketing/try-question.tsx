"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCountUp } from "@/hooks/use-count-up";
import {
  scoreAnswerHeuristically,
  type HeuristicFeedback,
} from "@/lib/answer-heuristics";
import { TILE_COLORS } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

const SAMPLE_QUESTIONS = [
  "Tell me about a time you led a project under a tight deadline.",
  "Describe a time you disagreed with a teammate. How did you handle it?",
  "Tell me about a goal you failed to reach. What did you learn?",
];

/**
 * One question, answered in the browser, scored by the heuristic. The card
 * keeps a single working height on desktop: the answer box fills it, then
 * gives that room to the result, so the copy beside it never jumps when a
 * score appears. That is what lets the section be middle-aligned like every
 * other two-column section on the page.
 */
export function TryQuestion() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<HeuristicFeedback | null>(null);
  const {
    value: displayScore,
    start: startScoreCount,
    reset: resetScoreCount,
  } = useCountUp(700);

  const question = SAMPLE_QUESTIONS[questionIndex];
  const ready = answer.trim().length >= 10;
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  const handleScore = () => {
    if (!ready) return;
    const result = scoreAnswerHeuristically(answer);
    setFeedback(result);
    startScoreCount(result.score);
  };

  const handleReset = () => {
    setAnswer("");
    setFeedback(null);
    resetScoreCount();
    setQuestionIndex((index) => (index + 1) % SAMPLE_QUESTIONS.length);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-soft-md lg:min-h-120">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5.5 py-4.5">
        <span
          className={cn(
            "inline-flex h-6 items-center self-start rounded-md px-2 text-xs font-semibold",
            TILE_COLORS.purple,
          )}
        >
          Behavioral
        </span>
        <p className="font-display text-xl font-semibold leading-snug tracking-[-0.01em] text-slate-900">
          {question}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 px-5.5 pt-5 pb-5.5">
        <label htmlFor="try-answer" className="sr-only">
          Your answer
        </label>
        <textarea
          id="try-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type how you'd actually answer this…"
          rows={5}
          className="min-h-33 w-full flex-1 resize-y rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary-muted"
        />

        {!feedback ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-slate-500">
              {ready
                ? `${wordCount} ${wordCount === 1 ? "word" : "words"}`
                : "Write a sentence or two to get a score"}
            </span>
            <Button onClick={handleScore} disabled={!ready} className="gap-2">
              Score my answer
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5" aria-live="polite">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-15 w-15 shrink-0 items-center justify-center rounded-xl font-display text-2xl font-bold tabular-nums",
                  feedback.score >= 80
                    ? "bg-success-muted text-success-emphasis"
                    : feedback.score >= 60
                      ? "bg-primary-subtle text-primary"
                      : "bg-warning-muted text-warning-emphasis",
                )}
              >
                {displayScore}
              </div>
              <div>
                <p className="text-[15px] font-semibold text-slate-900">
                  {feedback.score >= 80
                    ? "Strong answer"
                    : feedback.score >= 60
                      ? "Solid start"
                      : "Room to grow"}
                </p>
                <p className="text-[13px] text-slate-500">
                  Quick heuristic score · the full coach goes much deeper
                </p>
              </div>
            </div>

            {(feedback.strengths.length > 0 || feedback.tips.length > 0) && (
              <ul className="flex flex-col gap-2">
                {feedback.strengths.map((item, index) => (
                  <li
                    key={`s-${index}`}
                    className="grid grid-cols-[8px_1fr] items-start gap-2.5 text-sm leading-relaxed text-slate-600"
                  >
                    <span className="mt-1.75 h-2 w-2 rounded-[2px] bg-success" />
                    {item}
                  </li>
                ))}
                {feedback.tips.map((item, index) => (
                  <li
                    key={`t-${index}`}
                    className="grid grid-cols-[8px_1fr] items-start gap-2.5 text-sm leading-relaxed text-slate-600"
                  >
                    <span className="mt-1.75 h-2 w-2 rounded-[2px] bg-warning" />
                    {item}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleReset}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Try another question
              </button>
              <Button variant="outline" asChild>
                <Link href="/auth/register">Get the full report</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
