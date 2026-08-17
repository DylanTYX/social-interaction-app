/**
 * The `/api/coach/suggested-answer` wire contract.
 *
 * Declared once and imported by the route, both screens that render it, and the
 * table that caches it. `chat-contract.ts` exists one endpoint over because that
 * one was written out four times and drifted before anyone noticed.
 */
export interface SuggestedAnswerResult {
  /** An exemplary answer. Invented, so it is bound to no facts the user gave. */
  suggestedAnswer: string;
  /** The candidate's own answer, tightened. Bound to the facts they gave. */
  rewrite: string;
  /** 2-4 short improvements. Capped at 4 by `parseCoachResult`. */
  tips: string[];
}

/**
 * How the answer was given, which changes what counts as a flaw in it.
 *
 * Not cosmetic. A speech-to-text transcript arrives with no punctuation,
 * with "um", and with the false starts of someone thinking out loud — and a
 * coach that does not know it is reading one spends every tip on artefacts of
 * transcription while the actual answer goes unexamined. Code has the opposite
 * problem: the rewrite instruction says "tighten structure, add specificity",
 * which against a fenced function reads as an invitation to rewrite the
 * solution rather than to say what is wrong with it.
 *
 * `text` is the default and the historical behaviour, so an omitted field
 * coaches exactly as it did before this existed.
 */
export const ANSWER_MODES = ["text", "speech", "code"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

export function isAnswerMode(value: unknown): value is AnswerMode {
  return (
    typeof value === "string" &&
    (ANSWER_MODES as readonly string[]).includes(value)
  );
}
