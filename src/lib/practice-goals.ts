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

export interface PracticeProgress {
  /** Sessions *practised* this calendar week (Mon–Sun). */
  thisWeek: number;
  /** Current consecutive-day streak (today or yesterday anchored). */
  streakDays: number;
  /** Longest streak ever recorded in the provided history. */
  bestStreak: number;
}

export function computePracticeProgress(
  sessions: InterviewSessionSummary[],
): PracticeProgress {
  /**
   * Sessions that represent actual practice, not merely a launch.
   *
   * The row is created at the end of the setup wizard, before a single word is
   * exchanged — so this counted opening the wizard and closing the tab. Three
   * of those on a Monday read "3/3 · Goal hit", and one a day earned a
   * three-day streak. A streak is a motivation device; one that rewards opening
   * a page is worse than none.
   *
   * The bar is deliberately lower than `MIN_TURNS_TO_SCORE`: a short session is
   * still practice and should still keep a streak alive, it just should not
   * vote on how good you are. One exchange is enough to count as showing up.
   */
  const timestamps = sessions
    .filter((entry) => entry.turnCount >= MIN_TURNS_TO_PRACTISE)
    .map((entry) => Date.parse(entry.createdAt))
    .filter((ts) => !Number.isNaN(ts))
    .sort((a, b) => b - a);

  const weekStart = startOfWeek(new Date()).getTime();
  const thisWeek = timestamps.filter((ts) => ts >= weekStart).length;

  // Unique day keys for streak math.
  const dayKeys = new Set(timestamps.map((ts) => new Date(ts).toDateString()));

  // Current streak: walk back from today (allowing a 1-day grace if the user
  // hasn't practiced *today* yet but did yesterday).
  let streakDays = 0;
  const today = new Date();
  for (let offset = 0; offset < 365; offset += 1) {
    const probe = new Date(today);
    probe.setDate(today.getDate() - offset);
    if (dayKeys.has(probe.toDateString())) {
      streakDays += 1;
    } else if (offset > 0) {
      break;
    }
  }

  // Best streak across all recorded days.
  const sortedDays = Array.from(dayKeys)
    .map((key) => new Date(key).getTime())
    .sort((a, b) => a - b);
  let bestStreak = sortedDays.length > 0 ? 1 : 0;
  let run = bestStreak;
  const DAY_MS = 24 * 60 * 60 * 1000;
  for (let i = 1; i < sortedDays.length; i += 1) {
    const gap = Math.round((sortedDays[i] - sortedDays[i - 1]) / DAY_MS);
    if (gap === 1) {
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else if (gap > 1) {
      run = 1;
    }
  }

  return { thisWeek, streakDays, bestStreak };
}

export interface PracticeBadge {
  id: string;
  label: string;
  earned: boolean;
}

export function computeBadges(
  sessions: InterviewSessionSummary[],
  progress: PracticeProgress,
): PracticeBadge[] {
  const completed = sessions.filter((s) => s.status === "completed").length;
  const highScore = sessions.some(
    (s) => typeof s.averageScore === "number" && s.averageScore >= 85,
  );
  const triedVoice = sessions.some((s) => s.practiceMode === "voice");

  return [
    { id: "first", label: "First session", earned: sessions.length >= 1 },
    { id: "five", label: "5 sessions", earned: completed >= 5 },
    { id: "streak3", label: "3-day streak", earned: progress.bestStreak >= 3 },
    { id: "voice", label: "Tried voice", earned: triedVoice },
    { id: "ace", label: "Scored 85+", earned: highScore },
  ];
}
