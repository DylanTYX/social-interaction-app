/**
 * The questions already put to the candidate, listed for the interviewer.
 *
 * The instruction not to repeat itself pointed at the *rolling summary* — but
 * only three turns are kept verbatim and everything older is compressed into
 * four to seven bullets under 180 words. By turn ten, whether turn two's
 * question survives depends on what the summariser chose to keep, so
 * near-duplicate questions in the back half of a long session were likely and
 * nothing detected them.
 *
 * The other guard, `formatCoverageSteer`, switches itself off at both ends: it
 * returns nothing before anything is covered *and* once everything is — which
 * is exactly the point in a long session when repetition is most likely.
 *
 * Listing the questions verbatim costs a few dozen tokens and removes the
 * guesswork. It is deliberately the *questions* and not the whole turn: the
 * interviewer needs to know what it asked, not what it was told.
 */

/** How many recent questions to carry. Enough for a long round, bounded. */
const MAX_LISTED = 10;
/** Questions are one sentence; anything longer is preamble worth dropping. */
const MAX_QUESTION_CHARS = 160;

/**
 * Pull the question out of an interviewer turn.
 *
 * A turn is usually a sentence or two of acknowledgement followed by the
 * question, so the last sentence ending in a question mark is the part that
 * matters. Falling back to the whole trimmed text keeps rhetorical or
 * imperative prompts ("Walk me through your approach.") which carry no `?`.
 */
export function extractQuestion(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const questions = trimmed.match(/[^.!?]*\?/g);
  const candidate = questions?.at(-1)?.trim() || trimmed;

  return candidate.replace(/\s+/g, " ").slice(0, MAX_QUESTION_CHARS);
}

export function formatAskedQuestions(
  conversation: readonly { role: "user" | "assistant"; content: string }[],
): string | null {
  const seen = new Set<string>();
  const questions: string[] = [];

  // Newest first while de-duplicating, so when the cap bites it drops the
  // oldest — which the rolling summary is most likely to still cover.
  for (let i = conversation.length - 1; i >= 0; i -= 1) {
    const entry = conversation[i];
    if (entry.role !== "assistant") continue;

    const question = extractQuestion(entry.content);
    if (!question) continue;

    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(question);

    if (questions.length >= MAX_LISTED) break;
  }

  if (questions.length === 0) return null;

  return [
    "Questions you have already asked in this interview — do not ask these again, or a reworded version of them:",
    ...questions.reverse().map((question) => `- ${question}`),
  ].join("\n");
}
