/**
 * Every OpenAI model the app calls, in one place.
 *
 * Each call site used to carry its own `process.env.X ?? "…"` line, and the
 * evaluation harnesses carried copies of those lines. The copies drifted: the
 * interviewer moved to gpt-5-mini on 4 September 2026 (fc062c8) while the
 * persona harness kept a gpt-4o-mini default of its own, so the live run
 * committed on 18 September — the one the steering-note figures come from —
 * measured a model the app no longer used, under a comment saying it measured
 * the deployed behaviour. A harness now reads the same constant the app does;
 * an override has to be spelled out, and every run prints the model it used.
 *
 * The long form of each choice, with prices: docs/TOKEN-COST.md §"Which model
 * runs where". How a request body is built for a given model: model-params.ts.
 */

import { modelFamily } from "@/lib/model-params";

/**
 * `gpt-5.6-luna` since 2026-10-19, replacing `gpt-5-mini` (its snapshot retires
 * 2026-12-11).
 *
 * The interviewer's words are the product — persona fidelity, probe phrasing
 * and obedience to the steering note are what the realism requirement lives on
 * — so it keeps a model with a reasoning setting, called with none of it
 * (model-params.ts) so the first token still arrives at chat speed in a voice
 * interview. One model for every turn of a session: a second model is a second
 * prompt cache, and the session would pay for the full prefix twice.
 *
 * Moved on `npm run eval:persona -- --live --runs=51`, run for both models with
 * the same judge: every one of 153 topic pivots opened the subject it was told
 * to open, all six dial expectations held (as on gpt-5-mini), its follow-ups
 * were a third shorter and the run cost 30% less. Time to first word was a
 * median 892 ms against 903 ms. The first run on this model also found a fault
 * in the app rather than the model: six of the seven probe notes never told the
 * interviewer to quote the candidate, and a model that follows instructions
 * literally never did (0 of 51). They do now (51 of 51), see decision-engine.ts
 * and docs/PERSONA-EVAL.md §"Model migration".
 */
export const INTERVIEWER_MODEL =
  process.env.INTERVIEWER_MODEL ?? "gpt-5.6-luna";

/**
 * `gpt-5.6-luna` since 2026-10-19, replacing `gpt-5-mini` (its snapshot retires
 * 2026-12-11). Read verbatim by the user, and nobody is holding a microphone
 * open for it, so it can afford a planning pass (`low` effort) over the rubric.
 *
 * Moved on `npm run eval:coach -- --live`, run with the same scorer and judge
 * for both coaches: its rewrites lifted the analyzer's score by 11.4 points
 * against 9.7, invented no quantities (0.00 per rewrite against 0.23) and
 * covered every gap its tips were meant to name (1.00 against 0.80). It writes
 * longer rewrites (+29 words against +10), which is the caveat the harness
 * exists to show — docs/COACHING.md §"Results".
 */
export const COACH_MODEL = process.env.COACH_MODEL ?? "gpt-5.6-luna";

/**
 * `gpt-6-luna` since 2026-10-19, replacing `gpt-4o-mini` (retires 2027-01-14).
 *
 * Scoring runs at temperature 0.1 so the same answer scores the same twice.
 * gpt-6-luna takes a temperature when its reasoning is off, which is how it is
 * called (model-params.ts), so the repeatability claim survives the move. It
 * replaced the old model only after `npm run eval -- --runs=5`, run on the same
 * tree for both, gave it the same band accuracy (81.1%), a wider strong-to-weak
 * separation (43.7 points against 36.6) and steadier scores (mean standard
 * deviation 1.36 against 2.01) — docs/EVALUATION.md §"Model migration".
 */
export const ANALYZER_MODEL = process.env.ANALYZER_MODEL ?? "gpt-6-luna";

/**
 * Compression jobs with a correctness floor and no quality ceiling; they moved
 * with the assessor. No harness covers them, so each was spot-checked on both
 * models against known facts (2026-10-19): the summary kept all seven
 * checkable details where gpt-4o-mini dropped one, and the tidy-up removed
 * seven of seven boilerplate items and kept seven of seven requirement lines,
 * where gpt-4o-mini left one benefit line in.
 */
export const SUMMARY_MODEL = process.env.SUMMARY_MODEL ?? "gpt-6-luna";
export const JD_CLEAN_MODEL = process.env.JD_CLEAN_MODEL ?? "gpt-6-luna";

/**
 * Not overridable: every vector in `job_description_chunks` was produced by
 * this model, and a query embedded by any other would be compared against
 * them as though the two spaces were the same.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Evaluation harnesses only; the app never calls it. It sits on a different
 * generation (gpt-6) from the interviewer and coach (gpt-5.x), so a judge is
 * never rating the output of its own family.
 */
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gpt-6-luna";

/**
 * The judge-independence rule, for a harness header: null when the judge is
 * on a different generation from the model it rates, otherwise the warning to
 * print. The committed persona run of 18 September 2026 broke the rule by
 * accident — gpt-4o-mini judging gpt-4o-mini — and nothing said so.
 */
export function judgeWarning(judged: string, role: string): string | null {
  if (modelFamily(JUDGE_MODEL) !== modelFamily(judged)) return null;
  return `warning: the judge (${JUDGE_MODEL}) is the same generation as the ${role} (${judged}); set JUDGE_MODEL to another family before quoting this run.`;
}

export interface ModelRetirement {
  /** The day the model stops answering (ISO date). */
  shutdown: string;
  /** The model OpenAI names as the replacement. */
  replacement: string;
  /**
   * The model this project intends to move to, which is not always the named
   * replacement: gpt-5.6-terra costs eight times gpt-5-mini's input rate and
   * six times its output rate for the same 320-token turn.
   */
  candidate: string;
}

/**
 * Announced retirements, from https://developers.openai.com/api/docs/deprecations
 * read on 2026-10-19. Keyed by the undated alias the defaults above use; each
 * of these aliases has a single dated snapshot, which is what the page lists.
 *
 * A default moves off a retiring model only on a passing harness run — the
 * assessor on `npm run eval`, the interviewer on `npm run eval:persona -- --live`,
 * the coach on `npm run eval:coach -- --live` — against the committed baseline.
 * The runbook is docs/TOKEN-COST.md §"Retirements and the migration".
 */
export const MODEL_RETIREMENTS: Record<string, ModelRetirement> = {
  "gpt-5-mini": {
    shutdown: "2026-12-11",
    replacement: "gpt-5.6-terra",
    candidate: "gpt-5.6-luna",
  },
  "gpt-4o-mini": {
    shutdown: "2027-01-14",
    replacement: "gpt-6-luna",
    candidate: "gpt-6-luna",
  },
};

/** One line for a harness header, or null when nothing has been announced. */
export function retirementNotice(model: string): string | null {
  const retirement = MODEL_RETIREMENTS[model];
  if (!retirement) return null;
  return `${model} retires on ${retirement.shutdown}; the candidate replacement is ${retirement.candidate}`;
}
