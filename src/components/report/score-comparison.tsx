"use client";

import { useEffect, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import type { InterviewSessionSummary } from "@/hooks/use-interview-history";

/**
 * Fetches the user's session history and shows how this session's score
 * compares to the previous completed session (chronologically before this one).
 */
export function ScoreComparison({
  sessionId,
  currentScore,
  currentStartedAt,
}: {
  sessionId: string;
  currentScore: number | null;
  currentStartedAt: string;
}) {
  const [delta, setDelta] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch("/api/sessions?limit=50", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          sessions?: InterviewSessionSummary[];
        };
        // Two different reasons to stop, and neither wants a state write here:
        // `cancelled` means the component is gone, and the `finally` below
        // already sets `loaded` for the unscored case. This used to call
        // `setLoaded(true)` on both paths — including, precisely, after
        // unmount.
        if (cancelled || currentScore === null) return;
        const currentTs = Date.parse(currentStartedAt);
        const prior = (payload.sessions ?? [])
          .filter(
            (s) =>
              s.id !== sessionId &&
              s.status === "completed" &&
              typeof s.averageScore === "number" &&
              Date.parse(s.startedAt) < currentTs,
          )
          .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
        if (prior.length > 0 && typeof prior[0].averageScore === "number") {
          setDelta(Math.round(currentScore - prior[0].averageScore));
        }
      } catch (err) {
        // There was no catch here, so a network or parse failure escaped as an
        // unhandled rejection. Rendering nothing is the right *visible*
        // behaviour — this is a supplementary "vs your last session" line, and
        // an error card for it would be noise next to the real report — but
        // the failure should still be recorded rather than vanish.
        console.warn("Score comparison unavailable:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, currentScore, currentStartedAt]);

  if (!loaded || delta === null) return null;

  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const tone =
    delta > 0
      ? "text-emerald-600"
      : delta < 0
        ? "text-rose-600"
        : "text-muted-foreground";
  const label =
    delta > 0
      ? `+${delta} vs last session`
      : delta < 0
        ? `${delta} vs last session`
        : "Same as last session";

  return (
    // Fades in rather than appearing, because it arrives on its own schedule:
    // the score tile has already rendered by the time this fetch lands, so
    // without the transition a line of text simply materialises under a number
    // the reader is in the middle of taking in.
    <span
      className={`mt-1 inline-flex animate-in items-center gap-1 text-xs font-medium fade-in-0 slide-in-from-top-1 duration-300 ease-soft ${tone}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
