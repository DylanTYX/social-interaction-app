/**
 * The `/api/coach/model-answer` wire contract.
 *
 * Declared once and imported by the route that produces it, the two screens that
 * render it, and the table that caches it. It used to be written out four times
 * — the route, the drills page, the report page's `TurnCoaching`, and
 * `CoachAnswerPayload` in `db/coach-answers.ts`. Nothing had drifted yet, which
 * is the only reason this is a tidy-up rather than a bug fix; `chat-contract.ts`
 * exists one endpoint over because that one was not caught in time.
 *
 * The three fields are not interchangeable and the UI orders them deliberately:
 *
 *   - `tips` first, because they are the shortest thing that changes behaviour.
 *   - `rewrite` second, because it is the candidate's *own* answer improved, and
 *     is the only field bound to facts they actually supplied.
 *   - `modelAnswer` last, because it is an invented exemplar. Reading it before
 *     the rewrite invites copying someone else's story instead of tightening
 *     your own.
 */
export interface ModelAnswerResult {
  /** An exemplary answer to the question. Invented, not the candidate's. */
  modelAnswer: string;
  /** The candidate's own answer, tightened. Bound to the facts they gave. */
  rewrite: string;
  /** 2-4 short, specific improvements. Capped at 4 by the route. */
  tips: string[];
}
