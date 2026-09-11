"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Gauge } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Predict your score, then see it.
 *
 * The calibration card this replaces asked "how do you think you did?" from
 * below the overall score it was asking you to predict — the answer was on
 * screen before the question. The exercise is worth keeping (the gap between
 * how an interview felt and how it went is a real skill), so it now happens
 * first: the scores stay behind this until you predict or skip, once per
 * session. After that the report opens straight to them.
 *
 * Same storage key as the old card, so a prediction made there still counts.
 */

const STORAGE_PREFIX = "convotrainer.calibration.";
const SKIPPED = "skipped";

export type Prediction = { kind: "guessed"; guess: number } | { kind: "skipped" };

function readStored(key: string): Prediction | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === SKIPPED) return { kind: "skipped" };
    const guess = stored === null ? Number.NaN : Number.parseInt(stored, 10);
    return Number.isFinite(guess) ? { kind: "guessed", guess } : null;
  } catch {
    // Storage blocked: never trap the scores behind a question that cannot be
    // remembered.
    return { kind: "skipped" };
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered; the reveal still happens.
  }
}

export function ScoreReveal({
  sessionId,
  actualScore,
  children,
}: {
  sessionId: string;
  /** Null when nothing was scored — there is nothing to predict, so no gate. */
  actualScore: number | null;
  children: (prediction: Prediction | null, justRevealed: boolean) => ReactNode;
}) {
  const key = `${STORAGE_PREFIX}${sessionId}`;
  const [phase, setPhase] = useState<"reading" | "asking" | "shown">("reading");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [guess, setGuess] = useState(70);
  const [justRevealed, setJustRevealed] = useState(false);

  useEffect(() => {
    // Deferred a tick so the effect body holds no synchronous setState.
    const id = window.setTimeout(() => {
      const stored = readStored(key);
      setPrediction(stored);
      setPhase(stored ? "shown" : "asking");
    }, 0);
    return () => window.clearTimeout(id);
  }, [key]);

  if (actualScore === null) return <>{children(null, false)}</>;

  if (phase === "reading") {
    // Holds the space without flashing the scores the gate is about to hide.
    return <div className="h-44 animate-pulse rounded-2xl bg-slate-100" aria-hidden />;
  }

  if (phase === "asking") {
    const finish = (next: Prediction) => {
      store(key, next.kind === "guessed" ? String(next.guess) : SKIPPED);
      setPrediction(next);
      setJustRevealed(true);
      setPhase("shown");
    };

    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-blue-600" aria-hidden />
            Before you see your score
          </CardTitle>
          <CardDescription>
            How do you think that went? Predict your overall score first —
            noticing the gap between how an interview felt and how it actually
            went is a skill real interviews reward.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="flex items-end justify-between">
              <span className="text-sm text-slate-600">Your prediction</span>
              <span className="text-4xl font-bold tabular-nums text-blue-700">{guess}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={guess}
              aria-label="Your predicted score"
              aria-valuetext={`${guess} percent`}
              onChange={(event) => setGuess(Number(event.target.value))}
              className="mt-3 w-full accent-blue-600"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => finish({ kind: "guessed", guess })}>
              Reveal my score
            </Button>
            <Button variant="ghost" onClick={() => finish({ kind: "skipped" })}>
              Skip and show scores
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children(prediction, justRevealed)}</>;
}
