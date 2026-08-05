/**
 * Length caps for client-supplied text that reaches an LLM prompt.
 *
 * Kept in one place because the numbers only make sense relative to each other,
 * and because their absence was systemic rather than a single oversight:
 * document uploads were capped from the start, while the per-turn fields — the
 * ones billed on every message — were not bounded at all.
 *
 * These are **abuse and bug ceilings, not style guidance.** Each is set far
 * above anything a real candidate produces, so hitting one means a runaway
 * client loop or a deliberate attempt to run up the bill, and a 400 is the
 * right answer. Sizing rationale is in `docs/TOKEN-COST.md`.
 */

/**
 * One interview answer. ~10k characters is roughly a twelve-minute monologue at
 * conversational speed — several times the longest answer any interview format
 * asks for. This is the hottest field in the app: it reaches the interviewer,
 * the analyzer and an embedding call within a single request.
 */
export const MAX_USER_MESSAGE_CHARS = 10_000;

/** An interview question being coached. Questions are short by nature. */
export const MAX_COACH_QUESTION_CHARS = 4_000;

/** The answer being coached — same ceiling as a live answer, same reasoning. */
export const MAX_COACH_ANSWER_CHARS = 10_000;

/** Scenario title: a heading, shown in lists and used as a report title. */
export const MAX_SCENARIO_TITLE_CHARS = 200;

/**
 * Scenario description and round focus text. These land in the interviewer's
 * *stable* prompt layer, so they are paid for on every single turn of the
 * session rather than once.
 */
export const MAX_SCENARIO_DESCRIPTION_CHARS = 4_000;

/**
 * The rolling conversation summary. The client may PATCH this, and the server
 * feeds it back into the next prompt, so an unbounded value inflates every
 * remaining turn. The generator itself is capped at 400 output tokens.
 */
export const MAX_SUMMARY_CHARS = 4_000;

/** Any single persona free-text field (name, industry, seniority, a trait). */
export const MAX_PERSONA_FIELD_CHARS = 200;

/** Entries in a persona list field (traits, boundaries, interest areas). */
export const MAX_PERSONA_LIST_ITEMS = 12;
