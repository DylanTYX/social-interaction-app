/**
 * The written problem statement in a technical round.
 *
 * A coding problem is read, not heard. Its inputs, constraints and example are
 * what the candidate works from for the next twenty minutes, and a voice
 * interview withholds the interviewer's words by default — so the
 * problem was spoken once, bracket by bracket, and then could not be seen. Real phone screens do what this does instead: the interviewer talks,
 * and the problem is pasted into the shared editor.
 *
 * The interviewer is asked to put the statement in a fence tagged `problem`
 * (`round-types.ts`). Everything here is about that one fence: finding it in a
 * message that may still be streaming, and the latest one in a transcript.
 */

export const PROBLEM_FENCE_TAG = "problem";

const OPENER = "```" + PROBLEM_FENCE_TAG;

export interface ProblemSplit {
  /** What the interviewer says around the problem, fence removed. */
  spoken: string;
  /** The statement itself, or null when the message sets no problem. */
  problem: string | null;
}

/**
 * Separate a message into what is said and the problem it sets.
 *
 * Tolerates an unclosed fence, because the message arrives a token at a time:
 * mid-stream the statement is everything after the opener, and showing it as
 * it is written is better than showing nothing until the closing fence lands.
 */
export function splitProblemStatement(message: string): ProblemSplit {
  const start = message.indexOf(OPENER);
  if (start === -1) return { spoken: message, problem: null };

  const bodyStart = message.indexOf("\n", start);
  // The opener has arrived but not the line break after it: nothing to show
  // yet, and nothing after it is speech.
  if (bodyStart === -1) {
    return { spoken: message.slice(0, start).trim(), problem: "" };
  }

  const end = message.indexOf("```", bodyStart + 1);
  const body = end === -1 ? message.slice(bodyStart + 1) : message.slice(bodyStart + 1, end);
  const after = end === -1 ? "" : message.slice(end + 3);

  const spoken = [message.slice(0, start), after]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");

  return { spoken, problem: body.replace(/\s+$/, "") };
}

/** The most recent problem the interviewer set, for the panel above the editor. */
export function latestProblemStatement(
  messages: readonly { role: string; content: string }[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "user") continue;
    const { problem } = splitProblemStatement(message.content);
    if (problem) return problem;
  }
  return null;
}
