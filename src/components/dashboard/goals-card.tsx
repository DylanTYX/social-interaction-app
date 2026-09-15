"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";
import type { InterviewSessionSummary } from "@/hooks/use-interview-history";
import {
  WEEKLY_GOAL_OPTIONS,
  computePracticeProgress,
  loadWeeklyGoal,
  saveWeeklyGoal,
} from "@/lib/practice-goals";

const DAY_NAMES: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/**
 * This week's practice against the goal you set.
 *
 * It used to be a progress ring, a daily streak and five badges. The streak
 * rewarded a daily habit, which interview preparation is not, and the badges
 * marked milestones that say nothing about readiness; "Scored 85+" rewarded
 * choosing a supportive interviewer, which Analytics warns against. What is
 * left answers one planning question: how many sessions this week, on which
 * days, and how many are left.
 */
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

  // Render with a neutral default until the stored goal hydrates, to keep SSR
  // and the first client paint identical.
  const effectiveGoal = goal ?? 3;
  const complete = progress.thisWeek >= effectiveGoal;
  const remaining = Math.max(0, effectiveGoal - progress.thisWeek);
  const share = Math.min(1, progress.thisWeek / effectiveGoal);

  const handleGoalChange = (next: number) => {
    setGoal(next);
    saveWeeklyGoal(next);
  };

  return (
    <Card data-tour="goals" className="gap-0 py-0">
      <CardContent className="space-y-5 px-5 py-5">
        <div>
          <p className="font-display text-3xl leading-none font-bold tracking-tight text-navy tabular-nums">
            {progress.thisWeek}
            <span className="ml-1.5 font-sans text-base font-medium tracking-normal text-slate-500">
              of {effectiveGoal} session{effectiveGoal === 1 ? "" : "s"}
            </span>
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
            {complete ? (
              <>
                <Check className="h-4 w-4 text-success" aria-hidden />
                Goal met this week
              </>
            ) : (
              `${remaining} more to reach your goal this week`
            )}
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={effectiveGoal}
            aria-valuenow={Math.min(progress.thisWeek, effectiveGoal)}
            aria-label="Sessions this week"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-700 ease-soft",
                // Green only once the goal is met: that is a good mark.
                complete ? "bg-success" : "bg-primary",
              )}
              style={{ width: `${share * 100}%` }}
            />
          </div>
        </div>

        {/* Which days you practised. Past days you did not are quiet grey,
            today is outlined, and days still to come are left open. */}
        <ol className="grid grid-cols-7 gap-1.5" aria-label="This week by day">
          {progress.days.map((day) => (
            <li key={day.date} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "text-xs",
                  day.isToday
                    ? "font-semibold text-slate-900"
                    : "text-slate-500",
                )}
                aria-hidden
              >
                {day.label.charAt(0)}
              </span>
              <span
                className={cn(
                  "flex h-8 w-full items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                  day.sessions > 0
                    ? "bg-primary text-white"
                    : day.isFuture
                      ? "border border-dashed border-slate-200"
                      : "bg-slate-100",
                  day.isToday &&
                    day.sessions === 0 &&
                    "ring-2 ring-primary-border",
                )}
                aria-label={`${DAY_NAMES[day.label]}${day.isToday ? ", today" : ""}: ${
                  day.sessions === 0
                    ? day.isFuture
                      ? "still to come"
                      : "no practice"
                    : `${day.sessions} session${day.sessions === 1 ? "" : "s"}`
                }`}
              >
                {day.sessions > 1 ? day.sessions : ""}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className={PANEL_LABEL}>Weekly goal</span>
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Weekly goal"
          >
            {WEEKLY_GOAL_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleGoalChange(option)}
                aria-pressed={effectiveGoal === option}
                aria-label={`Set weekly goal to ${option} sessions`}
                className={cn(
                  "h-7 w-7 rounded-md text-xs font-semibold tabular-nums transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted",
                  effectiveGoal === option
                    ? "bg-primary text-white"
                    : "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
