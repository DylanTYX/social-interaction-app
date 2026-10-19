import { splitProblemStatement } from "@/lib/problem-statement";
import { inlineValue } from "@/lib/untrusted-content";

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
  // A coding problem is the question, and it sits in a fence after a spoken
  // line such as "take a minute to read it" — which is what the last-sentence
  // rule below would otherwise record as "already asked". The statement's
  // first line names the problem, so that is what stops it being set twice.
  const { problem } = splitProblemStatement(message);
  const problemLine = problem
    ?.split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (problemLine) return inlineValue(problemLine, MAX_QUESTION_CHARS);

  const trimmed = message.trim();
  if (!trimmed) return null;

  const questions = trimmed.match(/[^.!?]*\?/g);
  const candidate = questions?.at(-1)?.trim() || trimmed;

  // One line, capped, markers defused: this lands in system prompts, and the
  // message it came from is a row a signed-in user can write directly.
  return inlineValue(candidate, MAX_QUESTION_CHARS);
}

/**
 * Every distinct question the interviewer has put, oldest first.
 *
 * Split out of `formatAskedQuestions` when the loop brief needed the same list
 * for a different prompt layer. The two differ only in where they truncate, so
 * the walk — and with it what counts as "the same question already asked" —
 * lives here once.
 *
 * **Only assistant turns.** That is load-bearing rather than incidental: the
 * result is replayed into a *later* interviewer's system prompt via the loop
 * brief, so anything this collected from a `user` turn would be candidate-
 * controlled text crossing into a system message.
 */
export function collectAskedQuestions(
  conversation: readonly { role: "user" | "assistant"; content: string }[],
): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];

  // Walks newest-first and reverses at the end rather than walking forwards,
  // so that when a caller truncates it drops the oldest — and so that of two
  // identical questions it is the *later* one that survives de-duplication.
  for (let i = conversation.length - 1; i >= 0; i -= 1) {
    const entry = conversation[i];
    if (entry.role !== "assistant") continue;

    const question = extractQuestion(entry.content);
    if (!question) continue;

    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(question);
  }

  return questions.reverse();
}

export function formatAskedQuestions(
  conversation: readonly { role: "user" | "assistant"; content: string }[],
): string | null {
  // Oldest dropped first — those are the ones the rolling summary is most
  // likely to still cover.
  const questions = collectAskedQuestions(conversation).slice(-MAX_LISTED);

  if (questions.length === 0) return null;

  return [
    "Questions you have already asked in this interview — do not ask these again, or a reworded version of them:",
    ...questions.map((question) => `- ${question}`),
  ].join("\n");
}
