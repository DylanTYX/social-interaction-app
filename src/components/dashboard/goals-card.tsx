"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, Check, Flame, Target } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InterviewSessionSummary } from "@/hooks/use-interview-history";
import {
  WEEKLY_GOAL_OPTIONS,
  computeBadges,
  computePracticeProgress,
  loadWeeklyGoal,
  saveWeeklyGoal,
} from "@/lib/practice-goals";

/** Small circular progress ring rendered with SVG (no chart dependency). */
function ProgressRing({
  value,
  max,
  children,
}: {
  value: number;
  max: number;
  children: React.ReactNode;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const offset = circumference * (1 - ratio);
  const complete = value >= max && max > 0;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="8"
          className="stroke-slate-200"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out",
            complete ? "stroke-success" : "stroke-primary",
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function GoalsCard({
  sessions,
}: {
  sessions: InterviewSessionSummary[];
}) {
  const [goal, setGoal] = useState<number | null>(null);

  useEffect(() => {
    // Read after mount (not in the initializer) so SSR and the first client
    // paint match; defer one tick to avoid a synchronous setState in-effect.
    const id = window.setTimeout(() => setGoal(loadWeeklyGoal()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const progress = useMemo(() => computePracticeProgress(sessions), [sessions]);
  const badges = useMemo(
    () => computeBadges(sessions, progress),
    [sessions, progress],
  );

  // Render with a neutral default until the stored goal hydrates, to keep SSR
  // and the first client paint identical.
  const effectiveGoal = goal ?? 3;
  const complete = progress.thisWeek >= effectiveGoal;

  const handleGoalChange = (next: number) => {
    setGoal(next);
    saveWeeklyGoal(next);
  };

  const remaining = effectiveGoal - progress.thisWeek;
  const earnedCount = badges.filter((badge) => badge.earned).length;

  return (
    <Card data-tour="goals" className="border border-slate-200/80 shadow-soft">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Your week
            </h3>
            <p className="text-sm text-slate-500">
              Stay consistent — small reps add up.
            </p>
          </div>
          {complete && (
            <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-subtle px-2.5 py-1 text-xs font-semibold text-success-emphasis">
              <Check className="h-3 w-3" />
              Goal hit
            </span>
          )}
        </div>

        <div className="grid gap-3">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 text-center">
            <ProgressRing value={progress.thisWeek} max={effectiveGoal}>
              <span className="text-xl font-bold text-slate-900">
                {progress.thisWeek}
                <span className="text-sm font-medium text-muted-foreground">
                  /{effectiveGoal}
                </span>
              </span>
            </ProgressRing>
            <div>
              <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-900">
                <Target className="h-4 w-4 text-primary" />
                Weekly goal
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {complete
                  ? "Nice work this week."
                  : `${remaining} more session${remaining === 1 ? "" : "s"} to go`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {WEEKLY_GOAL_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => handleGoalChange(option)}
                  className={cn(
                    "h-8 w-8 rounded-lg text-xs font-semibold transition-colors",
                    effectiveGoal === option
                      ? "bg-primary text-white shadow-soft"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100",
                  )}
                  aria-label={`Set weekly goal to ${option}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <Flame className="h-7 w-7" />
            </div>
            <p className="text-3xl font-bold leading-none text-slate-900">
              {progress.streakDays}
              <span className="ml-1 text-base font-medium text-slate-500">
                day{progress.streakDays === 1 ? "" : "s"}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              Current streak · best {progress.bestStreak}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Award className="h-3.5 w-3.5" />
                Badges
              </p>
              <span className="text-xs font-medium text-muted-foreground">
                {earnedCount}/{badges.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span
                  key={badge.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                    badge.earned
                      ? "border-success-border bg-success-subtle text-success-emphasis"
                      : "border-slate-200 bg-white text-muted-foreground",
                  )}
                  title={badge.earned ? "Earned" : "Not yet earned"}
                >
                  {badge.earned && <Check className="h-3 w-3" />}
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
