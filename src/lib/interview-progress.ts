import type { InterviewRoundConfig } from "@/lib/interview-rounds";

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

/** Below this an interview cannot say anything useful; above it, fatigue wins. */
const MIN_TURNS = 4;
const MAX_TURNS = 20;

/** Used when a session has no round configured (legacy rows). */
export const DEFAULT_TARGET_TURNS = 8;

export function targetTurnsForDuration(durationMinutes: number): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return DEFAULT_TARGET_TURNS;
  }
  const raw = Math.round(durationMinutes / MINUTES_PER_TURN);
  return Math.min(MAX_TURNS, Math.max(MIN_TURNS, raw));
}

export function targetTurnsForRound(
  round: Pick<InterviewRoundConfig, "durationMinutes"> | undefined,
): number {
  return round
    ? targetTurnsForDuration(round.durationMinutes)
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
export function describeRoundLength(durationMinutes: number): string {
  const turns = targetTurnsForDuration(durationMinutes);
  return `${durationMinutes} min · ~${turns} questions`;
}
