import type { InterviewSessionSummary } from "@/hooks/use-interview-history";

const GOAL_STORAGE_KEY = "convotrainer.weeklyGoal";
const DEFAULT_WEEKLY_GOAL = 3;
export const WEEKLY_GOAL_OPTIONS = [2, 3, 5, 7] as const;

export function loadWeeklyGoal(): number {
  if (typeof window === "undefined") return DEFAULT_WEEKLY_GOAL;
  const raw = window.localStorage.getItem(GOAL_STORAGE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WEEKLY_GOAL;
}

export function saveWeeklyGoal(goal: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GOAL_STORAGE_KEY, String(goal));
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Messages before a session counts as having practised at all: the opening
 * greeting plus one exchange.
 */
export const MIN_TURNS_TO_PRACTISE = 3;

export interface PracticeDay {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** "Mon" through "Sun". */
  label: string;
  /** Sessions practised that day. */
  sessions: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface PracticeProgress {
  /** Sessions *practised* this calendar week (Mon–Sun). */
  thisWeek: number;
  /** Monday to Sunday of this week, with what was practised each day. */
  days: PracticeDay[];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * This week's practice, by day.
 *
 * A streak and five badges used to sit here. The streak measured a daily habit,
 * which interview preparation is not, and the badges rewarded milestones that
 * say nothing about readiness; "Scored 85+" in particular rewarded picking a
 * supportive interviewer. What is kept is the part worth planning around: how
 * many sessions you have done this week against the number you chose, and on
 * which days.
 */
export function computePracticeProgress(
  sessions: InterviewSessionSummary[],
  now: Date = new Date(),
): PracticeProgress {
  /**
   * Sessions that represent actual practice, not merely a launch.
   *
   * The row is created at the end of the setup wizard, before a single word is
   * exchanged — so this counted opening the wizard and closing the tab. Three
   * of those on a Monday read "3/3 · Goal hit". A goal that rewards opening a
   * page is worse than none.
   *
   * The bar is deliberately lower than `MIN_TURNS_TO_SCORE`: a short session is
   * still practice and should still count toward the week, it just should not
   * vote on how good you are. One exchange is enough to count as showing up.
   */
  const practised = sessions
    .filter((entry) => entry.turnCount >= MIN_TURNS_TO_PRACTISE)
    .map((entry) => Date.parse(entry.createdAt))
    .filter((ts) => !Number.isNaN(ts));

  const weekStart = startOfWeek(now);
  const counts = new Map<string, number>();
  for (const ts of practised) {
    if (ts < weekStart.getTime()) continue;
    const key = localDateKey(new Date(ts));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const todayKey = localDateKey(now);
  const days = DAY_LABELS.map((label, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = localDateKey(date);
    return {
      date: key,
      label,
      sessions: counts.get(key) ?? 0,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    };
  });

  return {
    thisWeek: days.reduce((sum, day) => sum + day.sessions, 0),
    days,
  };
}
