/**
 * Countable properties of a written answer.
 *
 * These were all being asked of the LLM. The analyzer's JSON schema requested a
 * word count, a count of hesitation markers, a count of qualifiers, a count of
 * self-corrections, a count of metrics, and whether timeframes appear — six
 * fields of arithmetic, paid for in both request scaffold and response tokens,
 * and produced by a model that has no particular reason to count accurately.
 *
 * Counting is not judgement. What stays with the model is everything that
 * genuinely needs reading comprehension: how vague the answer *feels*, how
 * assertive it reads, whether the examples are concrete, how deep it goes, and
 * every rubric score. What moved here is only what a regex can settle exactly.
 *
 * Related: `speech-metrics.ts` does the same for spoken delivery (pace, fillers,
 * pauses) from Azure's phrase timings. That module needs timing data and so is
 * voice-only; this one works on any text, so both interview modes get it.
 */

/** Hedges. "I think", "maybe", "sort of" — softeners around a claim. */
const HESITATION_PATTERNS: RegExp[] = [
  /\bi\s+think\b/gi,
  /\bi\s+guess\b/gi,
  /\bi\s+believe\b/gi,
  /\bi\s+feel\s+like\b/gi,
  /\bmaybe\b/gi,
  /\bperhaps\b/gi,
  /\bpossibly\b/gi,
  /\bprobably\b/gi,
  /\bkind\s+of\b/gi,
  /\bsort\s+of\b/gi,
  /\bnot\s+(?:really\s+)?sure\b/gi,
];

/** Contrastive turns — where a claim gets walked back or qualified. */
const QUALIFICATION_PATTERNS: RegExp[] = [
  /\bbut\b/gi,
  /\bhowever\b/gi,
  /\balthough\b/gi,
  /\bthough\b/gi,
  /\bthat\s+said\b/gi,
  /\bon\s+the\s+other\s+hand\b/gi,
  /\bexcept\b/gi,
];

/** Self-correction in flight: "actually", "sorry, I mean". */
const REVISION_PATTERNS: RegExp[] = [
  /\bactually\b/gi,
  /\bwait\b/gi,
  /\bsorry\b/gi,
  /\bi\s+mean\b/gi,
  /\blet\s+me\s+rephrase\b/gi,
  /\bto\s+correct\s+myself\b/gi,
  /\bor\s+rather\b/gi,
];

/**
 * Quantities: bare numbers, percentages, currency, and written multipliers.
 *
 * Ordinals and small written numbers are deliberately excluded — "the first
 * thing I did" is not a metric, and counting it would reward filler.
 */
const METRIC_PATTERNS: RegExp[] = [
  /\b\d+(?:[.,]\d+)?\s*%/g,
  /[$£€]\s*\d+(?:[.,]\d+)?[kmb]?\b/gi,
  /\b\d+(?:[.,]\d+)?\s*(?:k|m|bn|million|billion|thousand)\b/gi,
  /\b\d+(?:[.,]\d+)?\s*x\b/gi,
  /\b\d+(?:[.,]\d+)?\b/g,
];

/** Durations and dates — "three months", "in 2023", "within two weeks". */
const TIMEFRAME_PATTERNS: RegExp[] = [
  /\b\d+\s*(?:second|minute|hour|day|week|month|quarter|year)s?\b/gi,
  /\b(?:a|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:second|minute|hour|day|week|month|quarter|year)s?\b/gi,
  /\b(?:19|20)\d{2}\b/g,
  /\b(?:q[1-4])\b/gi,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
  /\b(?:daily|weekly|monthly|quarterly|annually|overnight)\b/gi,
];

export interface TextMetrics {
  /** Whitespace-delimited tokens. */
  wordCount: number;
  hesitationMarkers: number;
  qualificationCount: number;
  revisionsCount: number;
  metricCount: number;
  hasMetrics: boolean;
  hasTimeframes: boolean;
}

function countMatches(text: string, patterns: RegExp[]): number {
  let total = 0;
  for (const pattern of patterns) {
    // `matchAll` needs the global flag, which every pattern above carries.
    total += [...text.matchAll(pattern)].length;
  }
  return total;
}

/**
 * Strip fenced code blocks before counting prose.
 *
 * A coding-round answer is mostly source, and source is full of numbers,
 * `x`, and words like "actually" in comments. Counting those as hedges or
 * metrics would score the candidate's prose on their variable names.
 */
function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
}

export function analyzeText(raw: string): TextMetrics {
  const text = stripCodeBlocks(raw ?? "");
  const words = text.trim().split(/\s+/).filter(Boolean);
  const metricCount = countMatches(text, METRIC_PATTERNS);

  return {
    wordCount: words.length,
    hesitationMarkers: countMatches(text, HESITATION_PATTERNS),
    qualificationCount: countMatches(text, QUALIFICATION_PATTERNS),
    revisionsCount: countMatches(text, REVISION_PATTERNS),
    metricCount,
    hasMetrics: metricCount > 0,
    hasTimeframes: countMatches(text, TIMEFRAME_PATTERNS) > 0,
  };
}
