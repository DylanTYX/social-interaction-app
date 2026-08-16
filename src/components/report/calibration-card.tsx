"use client";

import { useEffect, useState } from "react";
import { Gauge, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCountUp } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";

/**
 * Calibration trainer: the candidate predicts their own score before seeing how
 * far off they were. Good interviewers have accurate self-awareness; tracking
 * the gap helps build it. The guess is stored per-session in localStorage so it
 * persists on revisits.
 */
export function CalibrationCard({
  sessionId,
  actualScore,
}: {
  sessionId: string;
  actualScore: number | null;
}) {
  const storageKey = `convotrainer.calibration.${sessionId}`;
  const [guess, setGuess] = useState(70);
  /**
   * Not a boolean, because the two ways of arriving at the revealed state
   * deserve different treatment. Pressing the button is the payoff the card is
   * built around, so it animates and counts the score up. Reopening a report
   * you already revealed weeks ago is not a payoff — replaying the flourish on
   * every visit would make it wallpaper — so the restored state renders
   * settled.
   */
  const [revealedBy, setRevealedBy] = useState<"user" | "restored" | null>(
    null,
  );
  const { value: countedScore, start: startCount } = useCountUp(900);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return;
    const parsed = Number.parseInt(stored, 10);
    if (!Number.isFinite(parsed)) return;
    // Deferred a tick to avoid a synchronous setState in the effect body.
    const id = window.setTimeout(() => {
      setGuess(parsed);
      setRevealedBy("restored");
    }, 0);
    return () => window.clearTimeout(id);
  }, [storageKey]);

  if (actualScore === null) return null;

  const revealed = revealedBy !== null;
  const finalScore = Math.round(actualScore);

  const handleReveal = () => {
    window.localStorage.setItem(storageKey, String(guess));
    setRevealedBy("user");
    startCount(finalScore);
  };

  const gap = Math.abs(Math.round(actualScore) - guess);
  const calibrationLabel =
    gap <= 5
      ? "Spot on — great self-awareness."
      : gap <= 15
        ? "Close — your instincts are solid."
        : guess > actualScore
          ? "You rated yourself higher than the scoring did."
          : "You were tougher on yourself than the scoring was.";

  return (
    <Card className="border-slate-200/80 bg-white print:hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-primary" />
          How did you think you did?
        </CardTitle>
        <CardDescription>
          Predict your score, then see the gap. Calibrating your self-assessment
          is half the battle in real interviews.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Your prediction</span>
            <span className="text-lg font-bold text-slate-900">{guess}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={guess}
            aria-label="Your predicted score"
            aria-valuetext={`${guess} percent`}
            disabled={revealed}
            onChange={(event) => setGuess(Number(event.target.value))}
            className="mt-2 w-full accent-primary disabled:opacity-60"
          />
        </div>

        {revealed ? (
          <div
            className={cn(
              "rounded-xl border border-slate-100 bg-slate-50/70 p-4",
              revealedBy === "user" &&
                "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-500 ease-soft",
            )}
          >
            <div className="flex items-center justify-around text-center">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  You guessed
                </p>
                <p className="text-2xl font-bold text-slate-900">{guess}%</p>
              </div>
              <div className="text-muted-foreground">vs</div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Actual
                </p>
                {/* `tabular-nums` so the counting digits do not jitter the
                    layout on their way up. */}
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {revealedBy === "user" ? countedScore : finalScore}%
                </p>
              </div>
            </div>
            <p
              className={cn(
                "mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700",
                // Held back until the count has essentially landed: the verdict
                // is a reaction to the number, so it should not precede it.
                // `fill-mode-both` is required — without it the delayed element
                // shows its final state first and then snaps back to the
                // animation's start.
                revealedBy === "user" &&
                  "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 delay-700 fill-mode-both",
              )}
            >
              <Sparkles className="h-4 w-4 text-warning" />
              {calibrationLabel} ({gap} point gap)
            </p>
          </div>
        ) : (
          <Button onClick={handleReveal} className="w-full">
            Reveal my score
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
