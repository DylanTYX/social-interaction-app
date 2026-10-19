import type {
  InterviewRoundConfig,
  InterviewRoundType,
} from "@/lib/interview-rounds";
import { supportsCodeEditor } from "@/lib/round-types";

/**
 * How long an interview runs.
 *
 * Every session used to end at a flat 12 scored turns regardless of round type,
 * while the `durationMinutes` a user configured was stored, displayed, and never
 * consulted — so a 5-minute recruiter screen and a 90-minute system design ran
 * identically. Deriving the target from the configured duration is what finally
 * makes that field mean something.
 *
 * A "turn" here is one substantive question and answer — trivial replies
 * ("yes", "ready") are not scored and do not count.
 */

/**
 * Minutes per substantive exchange. Two minutes is a realistic pace for a
 * question, a considered answer, and a short follow-up. The previous flat 12
 * turns implied ~75 seconds each on a 15-minute round, which no real interview
 * sustains.
 */
const MINUTES_PER_TURN = 2;

/**
 * Minutes per exchange in a round that writes code.
 *
 * At two minutes a 25-minute technical round expected about twelve answers,
 * but one of them is the solution itself, which can take most of the round —
 * so the progress header promised questions the round never had time to reach.
 * Five minutes gives the default round five exchanges, which is the shape the
 * technical ladder already walks: framing, approach, the code, its complexity,
 * its edge cases.
 */
const CODING_MINUTES_PER_TURN = 5;

/** The pace a round type is planned at. */
export function minutesPerTurn(type?: InterviewRoundType): number {
  return supportsCodeEditor(type) ? CODING_MINUTES_PER_TURN : MINUTES_PER_TURN;
}

/** Below this an interview cannot say anything useful; above it, fatigue wins. */
const MIN_TURNS = 4;
const MAX_TURNS = 20;

/** Used when a session has no round configured (legacy rows). */
export const DEFAULT_TARGET_TURNS = 8;

export function targetTurnsForDuration(
  durationMinutes: number,
  type?: InterviewRoundType,
): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return DEFAULT_TARGET_TURNS;
  }
  const raw = Math.round(durationMinutes / minutesPerTurn(type));
  return Math.min(MAX_TURNS, Math.max(MIN_TURNS, raw));
}

export function targetTurnsForRound(
  round:
    | (Pick<InterviewRoundConfig, "durationMinutes"> &
        Partial<Pick<InterviewRoundConfig, "type">>)
    | undefined,
): number {
  return round
    ? targetTurnsForDuration(round.durationMinutes, round.type)
    : DEFAULT_TARGET_TURNS;
}

/**
 * Whether the interview has run its course.
 *
 * Replaces `interview-state-machine.ts`'s `isInterviewComplete`, whose
 * `currentStage === "report"` clause was tautological — that stage was only ever
 * set *after* this function had already returned true — so only the turn count
 * ever fired.
 */
export function isInterviewComplete(
  scoredTurns: number,
  targetTurns: number,
): boolean {
  return scoredTurns >= targetTurns;
}

/** "20 min · ~10 questions" — shows what the duration setting actually buys. */
export function describeRoundLength(
  durationMinutes: number,
  type?: InterviewRoundType,
): string {
  const turns = targetTurnsForDuration(durationMinutes, type);
  return `${durationMinutes} min · ~${turns} questions`;
}


/**
 * A suggested rest before the next round, in minutes.
 *
 * This used to be a `breakMinutes` select in the setup wizard — a control whose
 * only effect anywhere was one string on the report. Asking the user to choose
 * it made them think about a setting that changed nothing they could feel, and
 * whichever value they picked, nothing in the app ever paused.
 *
 * Deriving it from the round they just finished keeps the (mild) realism nudge
 * and removes the decision: a long round earns a longer breather.
 */
export function suggestedBreakMinutes(durationMinutes: number): number {
  if (durationMinutes >= 45) return 10;
  if (durationMinutes >= 20) return 5;
  return 0;
}
