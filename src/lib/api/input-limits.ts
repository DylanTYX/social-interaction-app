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

/** Minimum usable resume text length. */
export const MIN_RESUME_CHARS = 80;
/**
 * The only ceiling on a resume, and the whole document up to it reaches the
 * interviewer.
 *
 * Six pages, at the 4,000-extracted-characters-per-page end of the estimate.
 * Resumes are written to whole page counts and an industry candidate submits one to
 * three, so this is roughly three times the longest real one — a backstop
 * against a paste that is not a resume at all, not a style guide.
 *
 * There used to be a second, smaller ceiling: the prompt clipped at 6,000
 * characters, which is *inside* a normal two-page resume, so ordinary documents
 * were being cut rather than runaway ones. Two limits where the smaller one
 * silently bit is how the interviewer came to know less than the database did.
 */
export const MAX_RESUME_CHARS = 24_000;

/**
 * A pasted job posting. Also the ceiling on what the tidy-up endpoint will
 * send to a model, which is why it lives here rather than in the route: the two
 * have to agree, or text that saves cannot be cleaned.
 */
export const MAX_JOB_DESCRIPTION_CHARS = 30_000;

/** Any single persona free-text field (name, industry, seniority, a trait). */
export const MAX_PERSONA_FIELD_CHARS = 200;

/** Entries in a persona list field (traits, boundaries, interest areas). */
export const MAX_PERSONA_LIST_ITEMS = 12;

/** A session's display name. Matches `interview_sessions_title_length` (`0001_schema.sql`). */
export const MAX_SESSION_TITLE_CHARS = 120;

/** Private notes on a report. Matches `interview_sessions_notes_length` (`0001_schema.sql`). */
export const MAX_SESSION_NOTES_CHARS = 4_000;

/** Tags on one session. Matches `interview_sessions_tag_count` (`0001_schema.sql`). */
export const MAX_SESSION_TAGS = 12;

/** One tag — long enough for "system design round 2", short enough for a chip. */
export const MAX_SESSION_TAG_CHARS = 32;

/** Sessions changed by one bulk action. */
export const MAX_BULK_SESSIONS = 100;
