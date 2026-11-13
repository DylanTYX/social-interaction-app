/**
 * What an interviewer does, said in words a candidate can check against the
 * interview they just had.
 *
 * Users could not tell the personas apart, and part of that was a measurement
 * problem (the dials' effects were small) and part a
 * presentation one: six bars and six numbers do not tell anyone what to listen
 * for. Two readouts fix the second half. Before a round, `personaSignature`
 * names the two or three things this interviewer will do that a typical one
 * will not. After it, `summariseMoves` counts what the interviewer actually
 * chose to do, from the strategy the engine stored for every scored turn.
 */

import type { PersonaConfig } from "@/lib/persona-engine";
import {
  isInterviewStrategy,
  type InterviewStrategy,
} from "@/lib/response-analyzer";

type DialKey =
  | "strictness"
  | "warmth"
  | "pace"
  | "pushback"
  | "probingDepth"
  | "unpredictability";

/** What each dial means at either end, as the candidate will experience it. */
const ENDS: Record<DialKey, { high: string; low: string }> = {
  strictness: {
    high: "Holds a high bar: wants numbers, names and dates before moving on",
    low: "Accepts a reasonable answer and moves on",
  },
  warmth: {
    high: "Friendly: puts you at ease, but never says whether an answer was good",
    low: "Formal: no small talk, straight to the question",
  },
  pace: {
    high: "Fast: short questions, little pause between them",
    low: "Patient: longer questions and room to think",
  },
  pushback: {
    high: "Challenges your claims and asks for the evidence",
    low: "Takes your answers at face value",
  },
  probingDepth: {
    high: "Picks up your exact words and digs into them",
    low: "Stays broad and rarely digs into one answer",
  },
  unpredictability: {
    high: "Throws curveballs and changes topic without warning",
    low: "Follows one thread, with few surprises",
  },
};

/** Ties break in this order: what is asked before how it sounds. */
const ORDER: DialKey[] = [
  "pushback",
  "probingDepth",
  "unpredictability",
  "strictness",
  "warmth",
  "pace",
];

/**
 * A dial says something about this interviewer only when it is far from the
 * middle. Three steps either side of 5 is the line: 2 and 8 qualify, 4 and 6
 * do not, which matches the settings the live experiment could tell apart.
 */
const DISTINCT_FROM_MIDDLE = 3;

export function personaSignature(
  config: Pick<PersonaConfig, "strictness" | "warmth"> &
    Partial<
      Pick<
        PersonaConfig,
        "pace" | "pushback" | "probingDepth" | "unpredictability"
      >
    >,
  max = 3,
): string[] {
  const distinct = ORDER.map((dial) => ({ dial, value: config[dial] ?? 5 }))
    .filter(({ value }) => Math.abs(value - 5) >= DISTINCT_FROM_MIDDLE)
    // Stable sort: equal distances keep ORDER.
    .sort((a, b) => Math.abs(b.value - 5) - Math.abs(a.value - 5));
  if (distinct.length === 0) {
    return ["A typical interviewer: nothing about their style is extreme"];
  }
  return distinct
    .slice(0, max)
    .map(({ dial, value }) => (value > 5 ? ENDS[dial].high : ENDS[dial].low));
}

/** Each move as the candidate would describe it. */
const MOVE_WORDS: Record<InterviewStrategy, string> = {
  DRILL_SPECIFICITY: "pushed for specifics",
  PROBE_ACTION: "picked up a phrase of yours and asked about it",
  CHALLENGE_OWNERSHIP: "asked what you did yourself",
  CLARIFY_SITUATION: "asked you to set the scene",
  EXPLORE_RESULT: "asked about the outcome",
  ACKNOWLEDGE_STRENGTH: "raised the bar after a strong answer",
  ASSESS_THINKING: "tested your reasoning",
  PIVOT_TOPIC: "changed topic",
  HYPOTHETICAL_TWIST: "posed a what-if",
};

export interface MoveCount {
  strategy: InterviewStrategy;
  words: string;
  count: number;
}

/**
 * How often the interviewer chose each move, most frequent first.
 *
 * Reads the stored strategy of each scored turn. Rows written before a
 * strategy existed, or with a value this build does not know, are skipped
 * rather than guessed.
 */
export function summariseMoves(
  strategies: readonly (string | null)[],
): MoveCount[] {
  const counts = new Map<InterviewStrategy, number>();
  for (const value of strategies) {
    if (!isInterviewStrategy(value)) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([strategy, count]) => ({
      strategy,
      words: MOVE_WORDS[strategy],
      count,
    }))
    .sort((a, b) => b.count - a.count || a.words.localeCompare(b.words));
}

const TIMES = (n: number) =>
  n === 1 ? "once" : n === 2 ? "twice" : `${n} times`;

/**
 * One sentence: "Pushed for specifics 3 times, changed topic twice and posed a
 * what-if once." Null when there is nothing to say.
 */
export function describeMoves(
  moves: readonly MoveCount[],
  max = 4,
): string | null {
  const shown = moves.slice(0, max).map((m) => `${m.words} ${TIMES(m.count)}`);
  if (shown.length === 0) return null;
  const text =
    shown.length === 1
      ? shown[0]
      : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
