"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  scoreAnswerHeuristically,
  type HeuristicFeedback,
} from "@/lib/answer-heuristics";

const SAMPLE_QUESTIONS = [
  "Tell me about a time you led a project under a tight deadline.",
  "Describe a time you disagreed with a teammate. How did you handle it?",
  "Tell me about a goal you failed to reach. What did you learn?",
];

export function TryQuestion() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<HeuristicFeedback | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const rafRef = useRef<number | null>(null);

  const question = SAMPLE_QUESTIONS[questionIndex];

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const animateScore = (target: number) => {
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleScore = () => {
    if (answer.trim().length < 10) return;
    const result = scoreAnswerHeuristically(answer);
    setFeedback(result);
    setDisplayScore(0);
    animateScore(result.score);
  };

  const handleReset = () => {
    setAnswer("");
    setFeedback(null);
    setDisplayScore(0);
    setQuestionIndex((index) => (index + 1) % SAMPLE_QUESTIONS.length);
  };

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-soft-lg">
      <div className="border-b border-gray-100 bg-linear-to-r from-blue-50 to-indigo-50/60 px-6 py-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
          <Sparkles className="h-3.5 w-3.5" />
          Try it now — no sign-up
        </p>
        <p className="mt-1 text-lg font-semibold text-gray-900">{question}</p>
      </div>

      <div className="space-y-4 p-6">
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type how you'd actually answer this…"
          rows={5}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/60 p-3 text-sm leading-relaxed outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />

        {!feedback ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {answer.trim().length < 10
                ? "Write a sentence or two to get a score"
                : `${answer.trim().split(/\s+/).length} words`}
            </span>
            <Button
              onClick={handleScore}
              disabled={answer.trim().length < 10}
              className="gap-2"
            >
              Score my answer
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl text-2xl font-bold tabular-nums ${
                  feedback.score >= 80
                    ? "bg-emerald-100 text-emerald-700"
                    : feedback.score >= 60
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {displayScore}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {feedback.score >= 80
                    ? "Strong answer"
                    : feedback.score >= 60
                      ? "Solid start"
                      : "Room to grow"}
                </p>
                <p className="text-xs text-gray-500">
                  Quick heuristic score · the full coach goes much deeper
                </p>
              </div>
            </div>

            {feedback.strengths.length > 0 && (
              <ul className="space-y-1">
                {feedback.strengths.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-emerald-700"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            )}

            {feedback.tips.length > 0 && (
              <ul className="space-y-1">
                {feedback.tips.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    {item}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1 gap-2">
                <Link href="/auth/register">
                  Get full AI feedback
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try another
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
