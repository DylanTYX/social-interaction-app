/**
 * What one dial actually changes, measured one dial at a time.
 *
 * The claim under test is the one the interface makes implicitly by drawing six
 * 1-10 sliders: **moving a dial changes how the interviewer questions you**.
 * Everything here is pure and offline, so the table it produces is
 * byte-identical on every run and can be shown live without a network.
 *
 * It answers a sharper question than "do two personas differ?", which the old
 * harness asked with two presets that differ on *every* dial — a difference
 * there cannot be attributed to anything. Here one dial moves 1 → 10 while the
 * others sit at the neutral middle, and every consumer of that dial is recorded
 * at each step. The interesting column is the last one: how many of the ten
 * steps produce a *different* outcome. Where that number is small, the dial is
 * banded and the report says so rather than implying ten levels of control.
 *
 * Consumers are called through their real entry points — `generatePersonaPrompt`,
 * `decideInterviewAction`, `estimateFollowupDifficulty`, `paceToRatePercent` — so
 * a change to any threshold shows up here instead of being restated.
 */

import {
  decideInterviewAction,
  estimateFollowupDifficulty,
} from "@/lib/decision-engine";
import { describeDifficulty } from "@/lib/interview-difficulty";
import {
  acceptanceBar,
  acknowledgementWords,
  contestCount,
  followupsBeforeMoving,
  generatePersonaPrompt,
  paceWordBudget,
  QUESTIONING_STYLES,
  reAskAllowance,
  unchallengedAllowed,
  specificsRequired,
  type PersonaConfig,
  type Pushback,
  type QuestioningStyle,
} from "@/lib/persona-engine";
import { paceToRatePercent } from "@/lib/speech-voices";
import { makeAnalysis } from "@/lib/test-support/analysis";
import { detectBehavioralSignals } from "@/lib/text-metrics";
import type { AnalysisResult } from "@/lib/response-analyzer";

export const DIAL_KEYS = [
  "strictness",
  "warmth",
  "pace",
  "pushback",
  "probingDepth",
  "unpredictability",
] as const;

export type DialKey = (typeof DIAL_KEYS)[number];

/** The ten settings a dial can hold, typed so no sweep needs a cast. */
export const DIAL_VALUES: readonly Pushback[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Turns per seeded sweep. Large enough that a rate is stable to ~1 point. */
export const SWEEP_TURNS = 200;

/** The neutral interviewer every sweep starts from: every dial at the middle. */
export function neutralPersona(): PersonaConfig {
  return {
    name: "Sweep Control",
    nationality: "Singaporean",
    voiceGender: "unspecified",
    industry: "Software",
    seniority: "Engineering Manager",
    communicationStyle: "direct",
    strictness: 5,
    warmth: 5,
    pace: 5,
    pushback: 5,
    probingDepth: 5,
    unpredictability: 5,
    questioningStyle: "conversational",
    yearsExperience: 10,
    personalityTraits: [],
    boundaries: [],
    interestAreas: [],
  };
}

/**
 * A middling answer, so no dial is pinned at a ceiling or a floor. Mirrors the
 * harness's own fixture: vague, unquantified, "it went okay" — the case where
 * an interviewer has the most room to choose.
 */
export const MIDDLING: AnalysisResult = makeAnalysis({
  overallScore: 58,
  specificityMetrics: {
    hasMetrics: false,
    metricCount: 0,
    hasTimeframes: false,
    hasStakeholders: true,
    vaguenessScore: 7,
    concreteExamples: 0,
  },
  responseQuality: {
    length: 46,
    isRelevant: true,
    addressesExplicitly: true,
    depthLevel: "surface",
    thinkingVisible: false,
  },
  strengths: [],
  gaps: ["no metrics", "unclear personal ownership"],
  followupTopics: ["what was cut", "how the decision was made"],
});

/** A strong answer: the only input that can reach the warmth slow-down gate. */
const STRONG = makeAnalysis({ overallScore: 86 });

/**
 * One hedged answer per signal type, in the taxonomy's own priority order, so
 * the probing-depth gate is exercised end to end through the real lexicon.
 */
export const PROBE_FIXTURES = [
  { signal: "ownership", text: "I was involved in the migration effort for our main service." },
  { signal: "decision", text: "We decided to move to Kafka for the event pipeline." },
  { signal: "leadership", text: "I led the replatforming of our checkout system." },
  { signal: "attribution", text: "It wasn't my fault — they didn't deliver the API on time." },
  { signal: "impact", text: "My caching change made the whole app significantly faster." },
  { signal: "technical", text: "I optimized the database when the reports got slow." },
  { signal: "learning", text: "I learned to communicate earlier with stakeholders." },
] as const;

const CURVEBALLS = new Set(["PIVOT_TOPIC", "HYPOTHETICAL_TWIST"]);

/**
 * Every line of the system prompt this dial changes, against the neutral one.
 *
 * Counting distinct *prompts* rather than distinct band phrases: a regex tuned
 * to one clause reports whatever that clause does and silently ignores any
 * other line the dial writes, which is exactly how a dial can be improved with
 * the measurement showing no change. Diffing the whole prompt cannot miss one.
 */
export function promptDelta(dial: DialKey, value: Pushback): string {
  const neutral = generatePersonaPrompt(neutralPersona()).split("\n");
  const changed = generatePersonaPrompt({
    ...neutralPersona(),
    [dial]: value,
  } as PersonaConfig).split("\n");

  return changed
    .filter((line, index) => line !== neutral[index])
    .join(" | ");
}

/** The band phrase a dial writes, for display. Null when it writes none. */
export function promptBand(dial: DialKey, persona: PersonaConfig): string | null {
  const prompt = generatePersonaPrompt(persona);
  const first = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match) return match[1] ?? match[0];
    }
    return null;
  };

  switch (dial) {
    case "strictness":
      return first([
        /(high expectations and won't tolerate mediocrity)/,
        /(moderate standards)/,
        /(flexible and understanding)/,
      ]);
    case "warmth":
      return first([
        /(warm and encouraging)/,
        /(professional and neutral)/,
        /(reserved and formal)/,
      ]);
    case "pace":
      return first([/Pace: ([a-z]+(?: and [a-z]+)?)/]);
    case "pushback":
      return first([/Pushback: ([a-z]+)/]);
    case "probingDepth":
      return first([/Probing depth: (\d+\/10)/]);
    // The one dial the interviewer is never told about. Its whole effect runs
    // through the decision engine, and the report says so rather than leaving a
    // reader to assume every dial is described to the model.
    case "unpredictability":
      return null;
  }
}

/** Share of seeded turns on a fine answer that the dial turns into a curveball. */
export function curveballRate(persona: PersonaConfig, turns = SWEEP_TURNS): number {
  let fired = 0;
  for (let turn = 0; turn < turns; turn += 1) {
    const outcome = decideInterviewAction(makeAnalysis(), {
      personaName: persona.name,
      questioningStyle: persona.questioningStyle,
      unpredictability: persona.unpredictability,
      pushback: persona.pushback,
      seed: { sessionId: "persona-sweep", turnIndex: turn },
      uncoveredCompetency: "how they handle production incidents",
    });
    if (CURVEBALLS.has(outcome.strategy)) fired += 1;
  }
  return fired / turns;
}

/** Of the curveballs that fire, the share that twist rather than pivot. */
export function twistShare(persona: PersonaConfig, turns = SWEEP_TURNS): number | null {
  let twists = 0;
  let curveballs = 0;
  for (let turn = 0; turn < turns; turn += 1) {
    const outcome = decideInterviewAction(makeAnalysis(), {
      personaName: persona.name,
      questioningStyle: persona.questioningStyle,
      // Held high so the sample of curveballs is large enough to take a share
      // of; the dial under test is the twist/pivot tilt, not the rate.
      unpredictability: 10,
      pushback: persona.pushback,
      seed: { sessionId: "persona-sweep-twist", turnIndex: turn },
      uncoveredCompetency: "how they handle production incidents",
    });
    if (!CURVEBALLS.has(outcome.strategy)) continue;
    curveballs += 1;
    if (outcome.strategy === "HYPOTHETICAL_TWIST") twists += 1;
  }
  return curveballs === 0 ? null : twists / curveballs;
}

/** Share of the seven hedged answers that earn a probe at this depth. */
export function probeRate(probingDepth: Pushback): number {
  const probed = PROBE_FIXTURES.filter((fixture) => {
    const outcome = decideInterviewAction(
      makeAnalysis({ languageSignals: detectBehavioralSignals(fixture.text) }),
      { personaName: "probe-sweep", probingDepth },
    );
    // A probe reason is the only one that quotes the candidate back.
    return outcome.reason.includes('"');
  }).length;
  return probed / PROBE_FIXTURES.length;
}

/**
 * What kind of consumer this is, because the counts mean different things.
 *
 * A dial that moves only a meter on screen has not changed the interview. The
 * headline number therefore counts `questioning` and `delivery` consumers and
 * leaves `readout` out of it, and the report prints both so the difference is
 * visible rather than argued.
 */
export type ConsumerKind =
  /** Changes what the interviewer asks, or the wording it is told to ask in. */
  | "questioning"
  /**
   * Changes the text the model receives, without that alone proving the
   * interview changes. The standards, pace and pushback lines state the dial's
   * own value, so this differs at all ten steps by construction — counting it
   * towards resolution would manufacture a ten out of ten for every dial.
   * Reported, never counted.
   */
  | "instruction"
  /** Changes how the question is spoken. Real, but only in a voice interview. */
  | "delivery"
  /** Changes a number on screen and nothing else. */
  | "readout"
  /** Recorded to show the dial is *not* consulted here. */
  | "unused";

export interface Consumer {
  name: string;
  kind: ConsumerKind;
  /** Where the value comes from, named so a reader can check it. */
  source: string;
}

export interface DialReading {
  value: number;
  /** Consumer name → what it produced at this value. */
  readings: Record<string, string>;
}

/**
 * The one quantity worth showing a human for this dial.
 *
 * "Ten distinct outcomes" is true and says nothing: distinct in what? A reader
 * who sees that strictness moves the bar an answer must clear from 45/100 to
 * 90/100 understands both that the dial works and what it does, from one line.
 * Chosen per dial because the dials do genuinely different things — there is no
 * single number that means the same across all six.
 */
export interface Headline {
  /** Plain words, no jargon: "Words of acknowledgement allowed". */
  label: string;
  /** Value at each setting 1-10. */
  values: number[];
  /** Appended to the first and last value, e.g. "%" or "/100". */
  unit: string;
}

export interface DialSweep {
  dial: DialKey;
  headline: Headline;
  consumers: Consumer[];
  points: DialReading[];
  /** Distinct outcomes across every consumer, readouts included. */
  distinctOutcomes: number;
  /**
   * Distinct outcomes across questioning consumers only — what a *typed*
   * interview resolves, and the answer to "does one step change the question?".
   */
  distinctQuestioning: number;
  /**
   * Questioning plus delivery. Differs from the above only for pace, whose
   * ten speech rates are real but reach a candidate only when they speak.
   */
  distinctExperienced: number;
  /**
   * Distinct values per consumer, so an aggregate cannot hide a flat column:
   * pace resolves ten speech rates but only four prompt bands, and a reader
   * practising by typing gets the four.
   */
  perConsumer: Record<string, number>;
  /** Runs of values whose questioning behaviour is identical, e.g. "5-7". */
  plateaus: string[];
  /** True when the dial changes nothing a candidate could experience. */
  inertQuestioning: boolean;
}

const pct = (value: number | null) =>
  value === null ? "—" : `${Math.round(value * 100)}%`;

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;

/** Every consumer of every dial, declared once so the columns cannot drift. */
export const DIAL_CONSUMERS: Record<DialKey, Consumer[]> = {
  strictness: [
    { name: "prompt", kind: "questioning", source: "generatePersonaPrompt (band phrase)" },
    { name: "bar", kind: "questioning", source: "acceptanceBar" },
    { name: "specifics", kind: "questioning", source: "specificsRequired" },
    { name: "reAsks", kind: "questioning", source: "reAskAllowance" },
    { name: "promptDelta", kind: "instruction", source: "whole-prompt diff vs neutral" },
    { name: "difficulty", kind: "questioning", source: "estimateFollowupDifficulty" },
    { name: "scoreBand", kind: "readout", source: "describeDifficulty" },
    { name: "confidence", kind: "readout", source: "decideInterviewAction().confidence" },
  ],
  warmth: [
    { name: "prompt", kind: "questioning", source: "generatePersonaPrompt (band phrase)" },
    { name: "ackWords", kind: "questioning", source: "acknowledgementWords" },
    { name: "promptDelta", kind: "instruction", source: "whole-prompt diff vs neutral" },
    { name: "difficulty", kind: "questioning", source: "estimateFollowupDifficulty" },
    { name: "slowsDown", kind: "questioning", source: "decideInterviewAction().shouldSlowDown" },
    { name: "scoreBand", kind: "readout", source: "describeDifficulty" },
    { name: "confidence", kind: "readout", source: "decideInterviewAction().confidence" },
  ],
  pace: [
    { name: "prompt", kind: "questioning", source: "generatePersonaPrompt (band phrase)" },
    { name: "wordBudget", kind: "questioning", source: "paceWordBudget" },
    { name: "speechRate", kind: "delivery", source: "paceToRatePercent" },
    { name: "decisionEngine", kind: "unused", source: "decisionContextFor omits pace" },
  ],
  pushback: [
    { name: "prompt", kind: "questioning", source: "generatePersonaPrompt (band phrase)" },
    { name: "contests", kind: "questioning", source: "contestCount" },
    { name: "unchallenged", kind: "questioning", source: "unchallengedAllowed" },
    { name: "promptDelta", kind: "instruction", source: "whole-prompt diff vs neutral" },
    { name: "twistShare", kind: "questioning", source: "decideInterviewAction over 200 seeded turns" },
  ],
  probingDepth: [
    { name: "followups", kind: "questioning", source: "followupsBeforeMoving" },
    { name: "promptDelta", kind: "instruction", source: "whole-prompt diff vs neutral" },
    { name: "probeRate", kind: "questioning", source: "decideInterviewAction over 7 hedged answers" },
  ],
  unpredictability: [
    { name: "prompt", kind: "unused", source: "generatePersonaPrompt omits unpredictability" },
    { name: "curveballRate", kind: "questioning", source: "decideInterviewAction over 200 seeded turns" },
  ],
};

/** Every consumer of one dial, read at one value. */
function readDial(dial: DialKey, value: Pushback): Record<string, string> {
  const persona = { ...neutralPersona(), [dial]: value } as PersonaConfig;
  const band = promptBand(dial, persona);
  const context = {
    personaName: persona.name,
    strictness: persona.strictness,
    warmth: persona.warmth,
    probingDepth: persona.probingDepth,
    pushback: persona.pushback,
    unpredictability: persona.unpredictability,
    questioningStyle: persona.questioningStyle,
  };

  switch (dial) {
    case "strictness":
    case "warmth": {
      const decision = decideInterviewAction(MIDDLING, context);
      const readings: Record<string, string> = {
        prompt: band ?? "—",
        promptDelta: promptDelta(dial, value),
        difficulty: `${estimateFollowupDifficulty(MIDDLING, context)}/10`,
        scoreBand: describeDifficulty(persona.strictness, persona.warmth).label,
        confidence: String(decision.confidence),
      };
      if (dial === "strictness") {
        readings.bar = `${acceptanceBar(value)}/100`;
        readings.specifics = String(specificsRequired(value));
        readings.reAsks = String(reAskAllowance(value));
      }
      if (dial === "warmth") {
        readings.ackWords = String(acknowledgementWords(value));
        // Only a strong answer can reach the gate at all, so it is read with
        // one: asking whether a weak answer slows down would always say no.
        readings.slowsDown = decideInterviewAction(STRONG, context).shouldSlowDown
          ? "yes"
          : "no";
      }
      return readings;
    }
    case "pace":
      return {
        prompt: band ?? "—",
        wordBudget: `${paceWordBudget(value)}w`,
        speechRate: signed(paceToRatePercent(value)),
        // Stated, not omitted: the chat route never puts pace on the decision
        // context, so in a typed interview this dial reaches nothing else.
        decisionEngine: "not consulted",
      };
    case "pushback":
      return {
        prompt: band ?? "—",
        contests: String(contestCount(value)),
        unchallenged: String(unchallengedAllowed(value)),
        promptDelta: promptDelta(dial, value),
        twistShare: pct(twistShare(persona)),
      };
    case "probingDepth":
      return {
        followups: String(followupsBeforeMoving(value)),
        promptDelta: promptDelta(dial, value),
        probeRate: pct(probeRate(value)),
      };
    case "unpredictability":
      return { prompt: "not in prompt", curveballRate: pct(curveballRate(persona)) };
  }
}

/** Consecutive runs of identical behaviour, as "3-5"; singletons are dropped. */
function plateausOf(points: DialReading[], keys: string[]): string[] {
  const key = (point: DialReading) =>
    JSON.stringify(keys.map((name) => point.readings[name]));
  const runs: string[] = [];
  let start = 0;

  for (let i = 1; i <= points.length; i += 1) {
    if (i < points.length && key(points[i]) === key(points[start])) continue;
    if (i - start > 1) runs.push(`${points[start].value}-${points[i - 1].value}`);
    start = i;
  }
  return runs;
}

function countDistinct(points: DialReading[], keys: string[]): number {
  return new Set(
    points.map((point) => JSON.stringify(keys.map((name) => point.readings[name]))),
  ).size;
}

/** Which reading to put in front of a reader, and what to call it. */
const HEADLINES: Record<DialKey, { consumer: string; label: string; unit: string }> = {
  strictness: { consumer: "bar", label: "Accepts an answer scoring", unit: "/100" },
  warmth: { consumer: "ackWords", label: "Words of acknowledgement allowed", unit: "" },
  pace: { consumer: "wordBudget", label: "Question length allowed", unit: " words" },
  pushback: { consumer: "unchallenged", label: "Unsupported claims let through", unit: "" },
  probingDepth: { consumer: "probeRate", label: "Hedged claims probed", unit: "%" },
  unpredictability: { consumer: "curveballRate", label: "Turns with a curveball", unit: "%" },
};

export function sweepDial(dial: DialKey): DialSweep {
  const consumers = DIAL_CONSUMERS[dial];
  const points: DialReading[] = DIAL_VALUES.map((value) => ({
    value,
    readings: readDial(dial, value),
  }));

  const all = consumers.map((consumer) => consumer.name);
  const named = (...kinds: ConsumerKind[]) =>
    consumers.filter((c) => kinds.includes(c.kind)).map((c) => c.name);
  const asked = named("questioning");
  const felt = named("questioning", "delivery");

  const headline = HEADLINES[dial];
  return {
    dial,
    headline: {
      label: headline.label,
      unit: headline.unit,
      // Every headline reading starts with its number ("45/100", "57w", "70%").
      values: points.map((point) =>
        Number.parseInt(point.readings[headline.consumer], 10),
      ),
    },
    consumers,
    points,
    distinctOutcomes: countDistinct(points, all),
    distinctQuestioning: countDistinct(points, asked),
    distinctExperienced: countDistinct(points, felt),
    perConsumer: Object.fromEntries(
      all.map((name) => [name, countDistinct(points, [name])]),
    ),
    plateaus: plateausOf(points, felt),
    inertQuestioning: countDistinct(points, felt) === 1,
  };
}

export function sweepAllDials(): DialSweep[] {
  return DIAL_KEYS.map(sweepDial);
}

export interface PushbackThreshold {
  style: QuestioningStyle;
  /** Lowest pushback whose curveballs are all twists, or null if never. */
  allTwistFrom: number | null;
  /** Highest pushback whose curveballs are all pivots, or null if never. */
  allPivotUntil: number | null;
}

/**
 * Where pushback's twist switch sits, per questioning style.
 *
 * `twistScore = pushback - 5 + twistBias`, and the bias is the style's, so the
 * same dial value means different things under different styles: a stress
 * interviewer twists from the bottom of the range, a supportive one barely at
 * all. This is the clearest case in the system of two dials interacting, and a
 * per-dial table alone would hide it.
 */
export function pushbackThresholds(turns = SWEEP_TURNS): PushbackThreshold[] {
  return QUESTIONING_STYLES.map((style) => {
    let allTwistFrom: number | null = null;
    let allPivotUntil: number | null = null;

    for (const pushback of DIAL_VALUES) {
      const share = twistShare(
        { ...neutralPersona(), questioningStyle: style, pushback },
        turns,
      );
      if (share === null) continue;
      if (share === 1 && allTwistFrom === null) allTwistFrom = pushback;
      if (share === 0) allPivotUntil = pushback;
    }
    return { style, allTwistFrom, allPivotUntil };
  });
}

/**
 * Answer qualities a real candidate actually produces, worst to best.
 *
 * Built to walk the ladder in `chooseStrategy` one rung at a time, because the
 * question this answers — "does the interviewer use more than one move?" —
 * cannot be answered from a single fixture. Holding the answer at "vague"
 * returns DRILL_SPECIFICITY every time, which says nothing about the system
 * and everything about the fixture.
 */
export const QUALITY_LADDER = [
  {
    label: "missing context",
    analysis: makeAnalysis({
      overallScore: 30,
      starAnalysis: {
        situation: { present: false, quality: 2, context: "" },
        task: { present: false, quality: 2, clarity: "" },
        action: { present: true, quality: 3, specificity: 3, ownership: 3, summary: "" },
        result: { present: false, quality: 2, quantified: false, impact: "" },
      },
    }),
  },
  {
    label: "vague action",
    analysis: makeAnalysis({
      overallScore: 45,
      starAnalysis: {
        situation: { present: true, quality: 6, context: "" },
        task: { present: true, quality: 6, clarity: "" },
        action: { present: true, quality: 3, specificity: 3, ownership: 6, summary: "" },
        result: { present: true, quality: 5, quantified: true, impact: "" },
      },
    }),
  },
  {
    label: "weak ownership",
    analysis: makeAnalysis({
      overallScore: 55,
      starAnalysis: {
        situation: { present: true, quality: 7, context: "" },
        task: { present: true, quality: 7, clarity: "" },
        action: { present: true, quality: 6, specificity: 6, ownership: 3, summary: "" },
        result: { present: true, quality: 6, quantified: true, impact: "" },
      },
    }),
  },
  {
    label: "no quantified result",
    analysis: makeAnalysis({
      overallScore: 62,
      starAnalysis: {
        situation: { present: true, quality: 7, context: "" },
        task: { present: true, quality: 7, clarity: "" },
        action: { present: true, quality: 7, specificity: 7, ownership: 7, summary: "" },
        result: { present: true, quality: 5, quantified: false, impact: "" },
      },
    }),
  },
  {
    label: "complete but hedged",
    analysis: makeAnalysis({
      overallScore: 68,
      specificityMetrics: {
        hasMetrics: true,
        metricCount: 1,
        hasTimeframes: true,
        hasStakeholders: true,
        vaguenessScore: 8,
        concreteExamples: 1,
      },
    }),
  },
  { label: "solid", analysis: makeAnalysis({ overallScore: 72 }) },
  { label: "strong", analysis: makeAnalysis({ overallScore: 85 }) },
  {
    label: "strong, hedged wording",
    analysis: makeAnalysis({
      overallScore: 85,
      languageSignals: detectBehavioralSignals(
        "I led the replatforming and we decided to move to Kafka.",
      ),
    }),
  },
] as const;

export interface StrategyCoverage {
  /** Strategy → share of all decisions. */
  shares: Record<string, number>;
  decisions: number;
  distinctStrategies: number;
  /** Which moves each answer quality can draw, in order. */
  byQuality: { label: string; strategies: string[] }[];
}

/**
 * Which of the nine moves the interviewer actually uses, and when.
 *
 * Two readings, and the second is the more honest one. Across the ladder the
 * interviewer uses eight of nine moves — it is not a one-note questioner. But
 * *within* one answer quality the move is almost always fixed: the persona
 * dials cannot override a weakness-driven choice, by design. So variety over an
 * interview comes from the candidate's answers changing, not from the dials.
 * Both numbers belong in the report; quoting only the first would overclaim.
 */
export function strategyCoverage(turns = 12): StrategyCoverage {
  const counts: Record<string, number> = {};
  const byQuality: { label: string; strategies: string[] }[] = [];

  for (const { label, analysis } of QUALITY_LADDER) {
    const seen = new Set<string>();
    for (const style of QUESTIONING_STYLES) {
      for (const probingDepth of [2, 5, 9] as const) {
        for (const unpredictability of [2, 5, 9] as const) {
          for (let turn = 0; turn < turns; turn += 1) {
            const { strategy } = decideInterviewAction(analysis, {
              personaName: "coverage",
              questioningStyle: style,
              probingDepth,
              unpredictability,
              pushback: 5,
              strictness: 5,
              warmth: 5,
              seed: { sessionId: "coverage", turnIndex: turn },
              uncoveredCompetency: "how they handle a production incident",
            });
            counts[strategy] = (counts[strategy] ?? 0) + 1;
            seen.add(strategy);
          }
        }
      }
    }
    byQuality.push({ label, strategies: [...seen].sort() });
  }

  const decisions = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    shares: Object.fromEntries(
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([strategy, n]) => [strategy, n / decisions]),
    ),
    decisions,
    distinctStrategies: Object.keys(counts).length,
    byQuality,
  };
}

export interface StyleSweep {
  style: QuestioningStyle;
  moveMix: Record<string, number>;
  curveballRate: number;
  twistShare: number | null;
}

/**
 * The categorical dial. Unlike the six numeric ones it cannot be swept, so it
 * is reported as a distribution per style over the same seeded turns.
 */
export function sweepStyles(turns = SWEEP_TURNS): StyleSweep[] {
  return QUESTIONING_STYLES.map((style) => {
    const persona = { ...neutralPersona(), questioningStyle: style };
    const moveMix: Record<string, number> = {};
    for (let turn = 0; turn < turns; turn += 1) {
      const outcome = decideInterviewAction(makeAnalysis(), {
        personaName: persona.name,
        questioningStyle: style,
        unpredictability: persona.unpredictability,
        pushback: persona.pushback,
        seed: { sessionId: "persona-sweep-style", turnIndex: turn },
        uncoveredCompetency: "how they handle production incidents",
      });
      moveMix[outcome.strategy] = (moveMix[outcome.strategy] ?? 0) + 1;
    }
    return {
      style,
      moveMix,
      curveballRate: curveballRate(persona, turns),
      twistShare: twistShare(persona, turns),
    };
  });
}
