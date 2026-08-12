/**
 * How hard this interviewer was, and what that means for the score.
 *
 * The rubric is persona-blind, which is the right design: `analyzeResponse`
 * never sees the persona, so nobody scores better simply by picking a kinder
 * interviewer. But the *questions* are not persona-blind —
 * `estimateFollowupDifficulty` folds `(strictness - warmth) / 4` into the
 * difficulty it asks the interviewer to aim for, and easier questions get
 * better answers, which score higher.
 *
 * So a 78 from a warm interviewer and a 78 from a demanding one are not the
 * same achievement, and until now nothing in the product said so — the
 * analytics page pooled them and drew one trend line. This is the smallest
 * honest fix: state the setting, and state what it does.
 *
 * "Are your scores comparable across personas?" is the question this answers.
 */

export type DifficultyBand = "gentle" | "balanced" | "demanding";

export interface DifficultyContext {
  band: DifficultyBand;
  label: string;
  /** One sentence, safe to render next to a score. */
  note: string;
}

/**
 * The same expression `estimateFollowupDifficulty` uses, so the description
 * cannot drift from the behaviour it describes.
 */
export function difficultyBias(
  strictness: number | undefined,
  warmth: number | undefined,
): number {
  return ((strictness ?? 5) - (warmth ?? 5)) / 4;
}

export function describeDifficulty(
  strictness: number | undefined,
  warmth: number | undefined,
): DifficultyContext {
  const bias = difficultyBias(strictness, warmth);

  // Bias runs roughly -2.25 to +2.25; a quarter-point either side of zero is
  // well inside noise, so the middle band is deliberately wide.
  if (bias >= 0.75) {
    return {
      band: "demanding",
      label: "Demanding interviewer",
      note: "This interviewer pushes harder than average, so questions ran tougher and this score is a strict read.",
    };
  }

  if (bias <= -0.75) {
    return {
      band: "gentle",
      label: "Supportive interviewer",
      note: "This interviewer goes easier than average, so questions ran gentler — expect a tougher persona to score you lower.",
    };
  }

  return {
    band: "balanced",
    label: "Balanced interviewer",
    note: "This interviewer sits near the middle for difficulty, so this score is a fair baseline to compare against.",
  };
}
