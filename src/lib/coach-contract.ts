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
