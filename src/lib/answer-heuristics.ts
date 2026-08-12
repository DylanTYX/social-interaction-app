/**
 * Lightweight, fully client-side answer scoring. This is deliberately NOT the
 * real LLM analyzer — it runs with zero auth and zero API cost so logged-out
 * visitors can "try one question" on the landing page and get instant,
 * plausible feedback. It rewards the same things the real rubric does
 * (specificity, structure, ownership) using cheap text heuristics.
 */

const FILLER_WORDS = [
  "um",
  "uh",
  "like",
  "basically",
  "actually",
  "literally",
  "kind of",
  "sort of",
  "you know",
  "i guess",
  "i mean",
];

const RESULT_WORDS = [
  "result",
  "outcome",
  "impact",
  "increased",
  "decreased",
  "reduced",
  "improved",
  "grew",
  "saved",
  "shipped",
  "delivered",
  "achieved",
  "led to",
  "%",
];

const ACTION_WORDS = [
  "i ",
  "i'd",
  "i've",
  "my ",
  "decided",
  "built",
  "created",
  "organized",
  "designed",
  "coordinated",
  "negotiated",
  "implemented",
];

const SITUATION_WORDS = [
  "when",
  "situation",
  "project",
  "team",
  "deadline",
  "challenge",
  "problem",
  "client",
  "customer",
  "manager",
];

export interface HeuristicFeedback {
  score: number;
  wordCount: number;
  tips: string[];
  strengths: string[];
}

function countOccurrences(haystack: string, needles: string[]): number {
  return needles.reduce((total, needle) => {
    let count = 0;
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      count += 1;
      index = haystack.indexOf(needle, index + needle.length);
    }
    return total + count;
  }, 0);
}

/** Sentences of three or more words before an answer counts as prose. */
const MIN_SENTENCES = 2;
/** The most a keyword run can score, however many magic words it contains. */
const KEYWORD_SALAD_CEILING = 45;

export function scoreAnswerHeuristically(raw: string): HeuristicFeedback {
  const text = raw.trim();
  const lower = ` ${text.toLowerCase()} `;
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const tips: string[] = [];
  const strengths: string[] = [];

  // Length: too short can't tell a story; very long rambles.
  let lengthScore = 0;
  if (wordCount < 25) {
    lengthScore = 8;
    tips.push("Add more detail — aim for 60–150 words to tell a full story.");
  } else if (wordCount <= 180) {
    lengthScore = 25;
    strengths.push("Good length — enough detail without rambling.");
  } else {
    lengthScore = 16;
    tips.push("Tighten it up — strong answers stay under ~180 words.");
  }

  // Specificity: numbers and concrete results.
  const hasNumbers = /\d/.test(text);
  const resultHits = countOccurrences(lower, RESULT_WORDS);
  let specificityScore = 0;
  if (hasNumbers) {
    specificityScore += 12;
    strengths.push("Quantified — concrete numbers make answers credible.");
  } else {
    tips.push("Quantify the impact (a %, a number, a timeframe).");
  }
  if (resultHits > 0) {
    specificityScore += 13;
    strengths.push("You named an outcome — interviewers reward results.");
  } else {
    tips.push("End with the result: what changed because of what you did?");
  }

  // Structure (STAR-ish): situation + action present.
  const situationHits = countOccurrences(lower, SITUATION_WORDS);
  const actionHits = countOccurrences(lower, ACTION_WORDS);
  let structureScore = 0;
  if (situationHits > 0) structureScore += 8;
  if (actionHits >= 2) {
    structureScore += 17;
    strengths.push("Clear ownership — you described what *you* did.");
  } else {
    tips.push("Use 'I' statements — make your personal role unmistakable.");
  }

  // Fillers: penalize lightly.
  const fillerHits = countOccurrences(lower, FILLER_WORDS);
  let fillerScore = 15;
  if (fillerHits >= 3) {
    fillerScore = 4;
    tips.push(`Trim filler words (found ~${fillerHits}). Pause instead.`);
  } else if (fillerHits === 0 && wordCount > 20) {
    strengths.push("Crisp delivery — no filler words.");
  }

  /**
   * Does this read like an answer, or like a list of the words that score well?
   *
   * Every component above rewards keyword *presence*, so
   * "I led, I delivered, 40% improvement in Q3, stakeholders, KPI" collected
   * length + numbers + a result word + two "I"s + no fillers = 90/100, on the
   * same 0-100 scale as the real analyzer, as the first number a prospective
   * user ever sees. That is a bad promise to open with.
   *
   * Sentences are the cheapest signal that separates the two: a real answer has
   * several, a keyword run has one or none. Fragments under three words do not
   * count, so "KPI. Stakeholders. Impact." does not buy its way through.
   */
  const sentences = text
    .split(/[.!?]+/)
    .filter((part) => part.trim().split(/\s+/).filter(Boolean).length >= 3);

  const readsAsProse = sentences.length >= MIN_SENTENCES;

  let score = Math.max(
    5,
    Math.min(98, lengthScore + specificityScore + structureScore + fillerScore),
  );

  if (!readsAsProse && wordCount >= 25) {
    // Capped rather than zeroed: the keywords are not *wrong*, they are simply
    // not an answer yet, and the tip says exactly that.
    score = Math.min(score, KEYWORD_SALAD_CEILING);
    tips.unshift(
      "Write it as full sentences — right now this reads as a list of keywords rather than a story.",
    );
    strengths.length = 0;
  }

  // Keep feedback digestible.
  return {
    score: Math.round(score),
    wordCount,
    tips: tips.slice(0, 3),
    strengths: strengths.slice(0, 3),
  };
}
