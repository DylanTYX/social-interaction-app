import type { InterviewRoundType } from "@/lib/interview-rounds";
import { ROUND_TYPE_SPECS } from "@/lib/round-types";

/**
 * How the interviewer's first turn is briefed.
 *
 * Every round used to share one hardcoded instruction in the chat route:
 *
 *   "Greet the candidate warmly, briefly introduce yourself and your role,
 *    explain the scenario, and ask if they're ready to begin."
 *
 * Two things were wrong with it. It opened a system-design round exactly the
 * way it opened an HR round, which is not what a real loop feels like. And the
 * last clause invited a one-word reply: the candidate typed "yes", which
 * `TRIVIAL_ANSWER` in the chat route matches and the analyzer therefore skips —
 * so the first exchange of every interview produced no score at all while still
 * consuming a turn.
 *
 * The fix is to make the opening carry a real question. The per-round wording
 * lives in `ROUND_TYPE_SPECS[type].opening`, next to the rubric and the focus it
 * has to agree with, so adding a round type cannot leave this half-configured.
 * What lives here is the part that is the same everywhere: who you are, why you
 * are both here, and the standing instruction never to ask for permission to
 * start.
 *
 * These are instructions, not lines to recite. The persona prompt already gives
 * the model a name, a seniority, an industry and a number of years
 * (`generatePersonaPrompt`); this only has to tell it to use them.
 */

export interface OpeningBriefInput {
  /** Undefined for a session with no configured rounds; treated as behavioural. */
  roundType?: InterviewRoundType;
  /**
   * The server-written handoff from the previous round of a loop. Its presence
   * is what makes this a continuation — round *index* is not enough, because
   * round 1 of a loop is still a cold open.
   */
  loopBrief?: string | null;
}

/** Kept in one place so the test and the prompt cannot drift apart. */
export const NO_READINESS_CHECK =
  "Do not ask whether they are ready, and do not wait for permission to begin. An interview does not start twice.";

export function buildOpeningInstruction({
  roundType,
  loopBrief,
}: OpeningBriefInput): string {
  // Matches `analyzeResponse`, which also falls back to behavioural rather than
  // inventing a seventh code path for "no round configured".
  const spec = ROUND_TYPE_SPECS[roundType ?? "behavioral"];
  const isContinuation = Boolean(loopBrief && loopBrief.trim());

  const framing = isContinuation
    ? "You are not the first interviewer this candidate has met today. Refer briefly to what the earlier round covered, using the handoff notes you were given, and say how your round differs from it."
    : "Say in one sentence why this conversation is happening and what you want to cover.";

  // The round still asks its own kind of question; what changes is whether it
  // assumes the candidate has already been introduced. Swapping the framing
  // alone left an HR round in position three still asking for a background
  // walkthrough two sentences after being told what the earlier rounds found.
  const opening = isContinuation ? spec.continuationOpening : spec.opening;

  return [
    "You are about to start the interview. This is your first turn and the candidate has not spoken yet.",
    "",
    "Open the way a real interviewer does:",
    "1. Introduce yourself by name and say what you actually do — your role, and one concrete detail about your team or your work. Use the identity you were given; do not invent a different one.",
    `2. ${framing}`,
    `3. ${opening}`,
    "",
    NO_READINESS_CHECK,
    "End your turn on the question itself, so the candidate knows exactly what to answer.",
    "",
    "Keep the whole thing to four or five sentences.",
  ].join("\n");
}
