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

  const score = Math.max(
    5,
    Math.min(98, lengthScore + specificityScore + structureScore + fillerScore),
  );

  // Keep feedback digestible.
  return {
    score: Math.round(score),
    wordCount,
    tips: tips.slice(0, 3),
    strengths: strengths.slice(0, 3),
  };
}
