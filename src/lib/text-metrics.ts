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
  // Latency and rate values: "800ms", "2.5s", "300 qps". The bare-number
  // pattern below cannot reach these — `\b` never falls between a digit and a
  // letter, so "800ms" contains no word boundary after the 800 — and they are
  // the most common engineering metric in a technical answer.
  /\b\d+(?:[.,]\d+)?\s*(?:ms|qps|rps|tps)\b/gi,
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

/* ------------------------------------------------------------------------- *
 * Behavioral signal detection
 *
 * The evidence-probing half of this module: typed signals that the candidate's
 * wording leaves their individual contribution, impact, or reasoning
 * unestablished. "Involved in" is not "in charge of"; "we decided" names no
 * decider; "significantly faster" carries no number.
 *
 * Three rules govern everything below (see docs/INTERVIEWER.md):
 *
 *   1. Signals trigger PROBING, never deductions. "I led" is a claim to
 *      verify, not a phrase to reward, and "we" is clarified, not penalised.
 *      The consumer that marks the answer down is the analyzer, judging the
 *      evidence the probe produced — not this lexicon.
 *   2. Every signal carries the exact matched phrases, so the interviewer can
 *      quote the candidate's own word back ("you said 'helped with' — what did
 *      you own?") instead of paraphrasing words they never used.
 *   3. Precision over recall. A missed signal costs nothing — the LLM analyzer
 *      still judges holistically. A false one makes the interviewer accuse a
 *      candidate of hedging words they chose deliberately. Patterns stay
 *      conservative.
 * ------------------------------------------------------------------------- */

export type BehavioralSignalType =
  /** "involved in", "helped with" — personal responsibility unestablished. */
  | "OWNERSHIP_AMBIGUOUS"
  /** "we decided" with no I-decision anywhere — the decider is unnamed. */
  | "DECISION_OWNER_UNCLEAR"
  /** "I led", "I owned" — a leadership claim awaiting its evidence. */
  | "LEADERSHIP_CLAIM_UNVERIFIED"
  /** "wasn't my fault", "they didn't deliver" — agency placed elsewhere. */
  | "EXTERNAL_ATTRIBUTION"
  /** "significantly faster" with zero metrics in the whole answer. */
  | "IMPACT_UNQUANTIFIED"
  /** "I optimized X" with no mechanism and no measurement. */
  | "TECHNICAL_CLAIM_UNVERIFIED"
  /** "I learned to..." — did the lesson change any behaviour? */
  | "LEARNING_UNVERIFIED";

export interface BehavioralSignal {
  type: BehavioralSignalType;
  /** The exact phrases matched, lowercased, deduplicated, in answer order. */
  markers: string[];
}

/** Diffuse-contribution phrasing: present in the work, role unstated. */
const DIFFUSE_OWNERSHIP_PATTERNS: RegExp[] = [
  /\b(?:was|were|been|being|am|is|are)\s+involved\s+in\b/gi,
  /\bparticipated\s+in\b/gi,
  /\bhelped\s+(?:with|to|out)\b/gi,
  /\bhelped\s+(?:build|develop|design|implement|create|launch)\b/gi,
  /\b(?:was|were)\s+(?:a\s+)?part\s+of\b/gi,
  /\bcontributed\s+to\b/gi,
  /\bassisted\s+(?:with|in|on)\b/gi,
  /\bwas\s+exposed\s+to\b/gi,
];

/**
 * Collective decisions. Matched only when no singular decision appears —
 * "we chose Redis" after "I proposed Redis" is a team ratifying a decision
 * whose owner is on record.
 */
const COLLECTIVE_DECISION_PATTERNS: RegExp[] = [
  /\bwe\s+(?:decided|chose|picked|selected|agreed|opted|went\s+with)\b/gi,
  /\bthe\s+team\s+(?:decided|chose|picked|selected|agreed)\b/gi,
  /\bit\s+was\s+decided\b/gi,
];

/** Singular decision ownership — the counter-evidence for the pattern above. */
const SINGULAR_DECISION_PATTERNS: RegExp[] = [
  /\bi\s+(?:decided|chose|picked|selected|proposed|recommended|opted|pushed\s+for|argued\s+for)\b/gi,
  /\bmy\s+(?:decision|call|recommendation|proposal)\b/gi,
];

/**
 * Leadership claims. These are strong words — which is exactly why they need
 * verification rather than credit. The probe asks what leading involved.
 */
const LEADERSHIP_CLAIM_PATTERNS: RegExp[] = [
  /\bi\s+(?:led|drove|owned|headed|spearheaded)\b/gi,
  /\bi\s+was\s+in\s+charge\s+of\b/gi,
  /\bi\s+was\s+responsible\s+for\b/gi,
  /\bi\s+took\s+(?:charge|ownership|the\s+lead)\b/gi,
];

/**
 * Blame placed wholly outside the candidate. Deliberately the most
 * conservative set in the file: describing a real external constraint is
 * legitimate, so only phrasing that disclaims agency outright matches.
 */
const EXTERNAL_ATTRIBUTION_PATTERNS: RegExp[] = [
  /\b(?:wasn't|was\s+not|isn't|is\s+not)\s+my\s+fault\b/gi,
  /\bnothing\s+i\s+could\s+(?:do|have\s+done)\b/gi,
  /\b(?:completely|entirely|totally)\s+(?:out\s+of|beyond)\s+my\s+control\b/gi,
  /\bthey\s+(?:didn't|did\s+not|failed\s+to)\s+deliver\b/gi,
  /\bbecause\s+(?:of\s+)?(?:the\s+)?other\s+team\b/gi,
];

/** Magnitude words that beg for a number. */
const UNQUANTIFIED_IMPACT_PATTERNS: RegExp[] = [
  /\bsignificantly\s+(?:faster|slower|better|improved|reduced|increased|higher|lower)\b/gi,
  /\b(?:greatly|drastically|dramatically|massively|hugely)\s+(?:improved|reduced|increased|faster|better)\b/gi,
  /\bmuch\s+(?:faster|better|more\s+efficient|more\s+reliable)\b/gi,
  /\bimproved\s+(?:a\s+lot|considerably|substantially)\b/gi,
  /\ba\s+lot\s+(?:faster|better|quicker)\b/gi,
];

/** First-person technical claims whose mechanism the probe asks for. */
const TECHNICAL_CLAIM_PATTERNS: RegExp[] = [
  /\bi\s+(?:optimized|optimised|improved|scaled|redesigned|refactored|fixed|sped\s+up|debugged)\b/gi,
];

/**
 * Mechanism markers — the "how" that verifies a technical claim. "By adding an
 * index", "because the query was unindexed". Presence of any suppresses
 * TECHNICAL_CLAIM_UNVERIFIED: the claim came with its reasoning.
 */
const MECHANISM_PATTERNS: RegExp[] = [
  /\bby\s+\w+ing\b/gi,
  /\bbecause\b/gi,
  /\bthe\s+(?:bottleneck|root\s+cause)\b/gi,
  /\bprofil(?:ed|ing)\b/gi,
  /\bmeasured\b/gi,
];

/** Stated lessons — the probe asks what behaviour changed afterwards. */
const LEARNING_CLAIM_PATTERNS: RegExp[] = [
  /\bi\s+(?:learned|learnt|realised|realized)\b/gi,
  /\b(?:the\s+|my\s+)(?:main\s+)?(?:lesson|takeaway)\b/gi,
];

const FIRST_PERSON_SINGULAR = /\b(?:i|i'm|i've|i'd|me|my|myself)\b/gi;
const FIRST_PERSON_PLURAL = /\b(?:we|we're|we've|we'd|us|our|ourselves)\b/gi;

/** Matched phrases, lowercased and deduplicated, in order of first appearance. */
function collectMarkers(text: string, patterns: RegExp[]): string[] {
  const found = new Map<string, number>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const marker = match[0].toLowerCase().replace(/\s+/g, " ");
      if (!found.has(marker)) found.set(marker, match.index ?? 0);
    }
  }
  return [...found.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([marker]) => marker);
}

export interface LanguageSignals {
  signals: BehavioralSignal[];
  /** The "we problem" context — never scored, shown on the report. */
  firstPersonSingular: number;
  firstPersonPlural: number;
}

/**
 * Detect behavioral signals in one answer.
 *
 * The composite conditions (impact words AND no metric; claim verbs AND no
 * mechanism) reuse `analyzeText`'s own counting so the two views of the text
 * cannot disagree about whether a number is present.
 */
export function detectBehavioralSignals(raw: string): LanguageSignals {
  const text = stripCodeBlocks(raw ?? "");
  const { metricCount } = analyzeText(raw ?? "");
  const signals: BehavioralSignal[] = [];

  const push = (type: BehavioralSignalType, markers: string[]) => {
    if (markers.length > 0) signals.push({ type, markers });
  };

  push("OWNERSHIP_AMBIGUOUS", collectMarkers(text, DIFFUSE_OWNERSHIP_PATTERNS));

  const collective = collectMarkers(text, COLLECTIVE_DECISION_PATTERNS);
  const singular = collectMarkers(text, SINGULAR_DECISION_PATTERNS);
  if (singular.length === 0) push("DECISION_OWNER_UNCLEAR", collective);

  push(
    "LEADERSHIP_CLAIM_UNVERIFIED",
    collectMarkers(text, LEADERSHIP_CLAIM_PATTERNS),
  );
  push(
    "EXTERNAL_ATTRIBUTION",
    collectMarkers(text, EXTERNAL_ATTRIBUTION_PATTERNS),
  );

  if (metricCount === 0) {
    push(
      "IMPACT_UNQUANTIFIED",
      collectMarkers(text, UNQUANTIFIED_IMPACT_PATTERNS),
    );
    if (collectMarkers(text, MECHANISM_PATTERNS).length === 0) {
      push(
        "TECHNICAL_CLAIM_UNVERIFIED",
        collectMarkers(text, TECHNICAL_CLAIM_PATTERNS),
      );
    }
  }

  push("LEARNING_UNVERIFIED", collectMarkers(text, LEARNING_CLAIM_PATTERNS));

  return {
    signals,
    firstPersonSingular: [...text.matchAll(FIRST_PERSON_SINGULAR)].length,
    firstPersonPlural: [...text.matchAll(FIRST_PERSON_PLURAL)].length,
  };
}
