/**
 * Does a dial change the question the model actually asks?
 *
 * Phase 1 (`persona-sweeps.ts`) proves the numbers are consumed. That is not
 * the same claim. An engine value that never changes a sentence is still
 * decoration, so this module moves **one dial at a time** against a live model
 * and has a blind judge rate what comes back.
 *
 * Three things make it an experiment rather than a demonstration:
 *
 *   1. **One factor at a time.** Every other dial sits at 5, so a difference
 *      belongs to the dial that moved. The two-preset comparison this harness
 *      started with cannot do that — those personas differ on everything.
 *   2. **A blind judge.** It is never told the persona, the dial or the level,
 *      and it rates all four axes for every follow-up, so it cannot agree with
 *      a label it was handed.
 *   3. **Expectations written down first.** `EXPECTATIONS` below is declared in
 *      code, before any run. The report prints the intended effect *and* the
 *      three unintended ones, so a dial that moves every axis shows up as the
 *      failure of orthogonality it is, rather than being quietly dropped.
 *
 * A no-persona control runs alongside: the same question and answer with a
 * plain interviewer prompt. Without it, "strictness 9 scores 7.2 demanding"
 * has no zero to be measured from.
 */

import { generatePersonaPrompt, type PersonaConfig } from "@/lib/persona-engine";
import {
  decideInterviewAction,
  estimateFollowupDifficulty,
} from "@/lib/decision-engine";
import { buildSteeringBlock } from "@/lib/steering-block";
import { UsageCollector } from "@/lib/api/token-usage";
import { completionParams } from "@/lib/model-params";

import { makeAnalysis } from "@/lib/test-support/analysis";
import { detectBehavioralSignals } from "@/lib/text-metrics";
import type { AnalysisResult } from "@/lib/response-analyzer";

import { bootstrapDiffCI, mean, stdDev } from "./stats";
import { DIAL_KEYS, neutralPersona, type DialKey } from "./persona-sweeps";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.INTERVIEWER_MODEL ?? "gpt-4o-mini";
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gpt-4o-mini";

/**
 * The one exchange every arm responds to, so only the dial varies.
 *
 * The answer is deliberately a **good** one, and that is a finding rather than
 * a convenience. The engine's precedence rule is that a weakness-driven move
 * always wins: against a vague answer every persona returns DRILL_SPECIFICITY,
 * no probe is considered and no curveball may fire, so four of the six dials
 * are switched off — correctly, and by design. Measuring what a dial does
 * therefore requires an answer that has cleared the fundamentals.
 *
 * It is also written so both dial-sensitive branches stay reachable: it carries
 * one low-priority hedge ("I learned to…"), which only a high probing depth
 * catches, so depths 2 and 5 leave the curveball roll free for unpredictability
 * and pushback while depth 9 takes the probe. Verified against the real engine,
 * not assumed — see `docs/PERSONA-EVAL.md` §"Why the answer is a good one".
 */
export const HELD_CONSTANT = {
  scenario:
    "Practising for a Senior Product Manager role at a mid-size software company.",
  question:
    "Tell me about a time you had to deliver a project with an unrealistic deadline.",
  answer:
    "We had six weeks for a launch that needed ten. I cut two features after mapping which ones drove activation, and I took that to the stakeholders myself. We shipped the core flow on the original date at about 85% of scope, and activation held at 31%. Afterwards I learned to raise scope risk earlier with stakeholders.",
};

/**
 * The analyzer's verdict on that answer, as the engine would receive it.
 *
 * Hand-built rather than generated: the experiment varies one thing, and a
 * live analyzer call per run would vary the score too, so a dial's effect
 * could not be separated from the scorer's noise. The `languageSignals` are
 * computed from the real lexicon on the real text, so the probe gate is
 * exercised end to end rather than fed a fixture.
 */
const SOLID: AnalysisResult = makeAnalysis({
  // `makeAnalysis` already describes a strong answer — cleared fundamentals,
  // quantified result, low vagueness — which is exactly the state the dials
  // become reachable in. Only the two things specific to *this* answer are set.
  languageSignals: detectBehavioralSignals(HELD_CONSTANT.answer),
  gaps: ["did not say who else pushed back"],
});

export const JUDGE_AXES = [
  "demandingness",
  "supportiveness",
  "adaptivity",
  "topicShift",
] as const;

export type JudgeAxis = (typeof JUDGE_AXES)[number];

/** The low and high settings each dial is tested at, either side of neutral. */
export const LOW = 2;
export const HIGH = 9;

export interface Expectation {
  /** The axis this dial is designed to move, or null if it should move none. */
  axis: JudgeAxis | null;
  /** Sign of the expected high-minus-low difference. */
  direction: "increase" | "decrease" | "none";
  why: string;
}

/**
 * Pre-registered, in the literal sense: committed before the run, and printed
 * next to the result whether or not it held.
 */
export const EXPECTATIONS: Record<DialKey, Expectation> = {
  strictness: {
    axis: "demandingness",
    direction: "increase",
    why: "the prompt band asks for higher standards and estimateFollowupDifficulty raises the target",
  },
  warmth: {
    axis: "supportiveness",
    direction: "increase",
    why: "the prompt band asks for encouragement, and the slow-down gate opens at 7",
  },
  pace: {
    axis: null,
    direction: "none",
    why: "pace's only numeric consumer is the speech rate; the decision engine is never told it",
  },
  pushback: {
    axis: "demandingness",
    direction: "increase",
    why: "the prompt band asks the interviewer to challenge claims and ask for evidence",
  },
  probingDepth: {
    axis: "adaptivity",
    direction: "increase",
    why: "it raises the probe tier limit, so more hedged phrases are worth quoting back",
  },
  unpredictability: {
    axis: "topicShift",
    direction: "increase",
    why: "it raises the curveball chance, which pivots the topic or poses a hypothetical",
  },
};

export interface Cell {
  /** null on the control and the shared neutral cell. */
  dial: DialKey | null;
  level: number | null;
  label: string;
  persona: PersonaConfig | null;
}

/**
 * Every arm of the experiment.
 *
 * The neutral cell is generated **once** and reused as each dial's midpoint:
 * the persona at strictness 5 and the persona at warmth 5 are the same object,
 * so paying for six identical cells would buy nothing but a larger bill.
 */
export function buildCells(): Cell[] {
  const cells: Cell[] = [
    { dial: null, level: null, label: "control (no persona)", persona: null },
    {
      dial: null,
      level: 5,
      label: "neutral (every dial at 5)",
      persona: neutralPersona(),
    },
  ];

  for (const dial of DIAL_KEYS) {
    for (const level of [LOW, HIGH]) {
      cells.push({
        dial,
        level,
        label: `${dial} ${level}`,
        persona: { ...neutralPersona(), [dial]: level } as PersonaConfig,
      });
    }
  }
  return cells;
}

/** The plain interviewer the control uses: a competent one, with no persona. */
const CONTROL_PROMPT = [
  "You are a professional job interviewer conducting a behavioural interview.",
  "Ask questions that help you assess the candidate fairly.",
].join("\n");

export interface Followup {
  cell: string;
  dial: DialKey | null;
  level: number | null;
  run: number;
  /** The strategy the engine chose for this run, or null for the control. */
  strategy: string | null;
  text: string;
  scores: Record<JudgeAxis, number>;
  /** Cheap, deterministic descriptors of the text, at no API cost. */
  shape: TextShape;
  reasoning: string;
}

export interface TextShape {
  words: number;
  sentences: number;
  questions: number;
  hedges: number;
  /** Whether the follow-up quotes the candidate's own wording back at them. */
  echoesCandidate: boolean;
}

const HEDGES =
  /\b(maybe|perhaps|possibly|might|could|somewhat|a bit|sort of|kind of|if you don't mind|feel free|no worries|take your time)\b/gi;

/** Words in the answer worth calling an echo — long enough to be distinctive. */
const ANSWER_WORDS = new Set(
  HELD_CONSTANT.answer
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 6),
);

export function describeShape(text: string): TextShape {
  const words = text.split(/\s+/).filter(Boolean);
  const echoed = words.filter((word) =>
    ANSWER_WORDS.has(word.toLowerCase().replace(/[^a-z]/g, "")),
  );
  return {
    words: words.length,
    sentences: (text.match(/[.!?]+/g) ?? []).length,
    questions: (text.match(/\?/g) ?? []).length,
    hedges: (text.match(HEDGES) ?? []).length,
    // Two shared distinctive words, so one incidental "stakeholders" is not
    // counted as engaging with what the candidate actually said.
    echoesCandidate: echoed.length >= 2,
  };
}

async function chat(
  apiKey: string,
  usage: UsageCollector,
  stage: "interviewer" | "analyzer",
  model: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, ...body }),
  });
  if (!response.ok) {
    throw new Error(`${stage} ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: Parameters<UsageCollector["record"]>[2];
  };
  usage.record(stage, model, data.usage);
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * The private note the route sends alongside the persona, rebuilt here.
 *
 * Without this the experiment measures the persona *prose* only, and two of the
 * six dials — probingDepth and unpredictability — appear in no prose at all.
 * Their entire effect is the decision this block reports, so omitting it would
 * have guaranteed a null result and then read it as "the dial does nothing".
 *
 * `turnIndex` is the run number: the curveball is seeded on
 * `(sessionId, turnIndex)`, so a dial that fires on 38% of turns can only show
 * that rate across runs that are actually different turns. Twelve runs of turn
 * zero would be twelve copies of one decision.
 */
function steeringFor(
  cell: Cell,
  run: number,
): { block: string; strategy: string } | null {
  if (!cell.persona) return null;
  const persona = cell.persona;

  const context = {
    personaName: persona.name,
    strictness: persona.strictness,
    warmth: persona.warmth,
    probingDepth: persona.probingDepth,
    pushback: persona.pushback,
    unpredictability: persona.unpredictability,
    questioningStyle: persona.questioningStyle,
    seed: { sessionId: "persona-experiment", turnIndex: run },
    uncoveredCompetency: "how they handle a production incident",
  };

  const decision = decideInterviewAction(SOLID, context);
  return {
    strategy: decision.strategy,
    block: buildSteeringBlock(
      SOLID,
      decision.strategy,
      decision.reason,
      decision.nextFocus,
      estimateFollowupDifficulty(SOLID, context),
      decision.shouldEscalate,
      decision.shouldSlowDown,
    ),
  };
}

async function generate(
  cell: Cell,
  run: number,
  apiKey: string,
  usage: UsageCollector,
  steering: string | null,
): Promise<string> {
  return chat(apiKey, usage, "interviewer", MODEL, {
    // The app's own interviewer settings, so this measures the deployed
    // behaviour rather than a quieter version of it.
    ...completionParams(MODEL, {
      temperature: 0.7,
      maxTokens: 320,
      reasoningEffort: "minimal",
    }),
    messages: [
      {
        role: "system",
        content: [
          cell.persona ? generatePersonaPrompt(cell.persona) : CONTROL_PROMPT,
          `\nScenario context: ${HELD_CONSTANT.scenario}`,
          "\nAsk exactly one follow-up question. Keep it to 1-3 sentences.",
        ].join("\n"),
      },
      // The route folds this into a behaviour layer of the system prompt; here
      // it is its own system message. Same role, same content, same position
      // before the exchange — the placement is an approximation, the text is not.
      ...(steering ? [{ role: "system", content: steering }] : []),
      { role: "assistant", content: HELD_CONSTANT.question },
      { role: "user", content: HELD_CONSTANT.answer },
    ],
  });
}

const JUDGE_RUBRIC = [
  "You rate one interviewer follow-up question on four independent dimensions.",
  "Rate each on its own. A question can be high on several or low on all.",
  "",
  "DEMANDINGNESS (1-10): 1 = accepts the answer and moves on. 10 = challenges the claim, asks for evidence, numbers or the weakest point.",
  "SUPPORTIVENESS (1-10): 1 = cold, clipped, no acknowledgement. 10 = warm, encouraging, explicitly makes space for the candidate.",
  "ADAPTIVITY (1-10): 1 = generic, could follow any answer. 10 = engages this candidate's actual words and the specific gap they left.",
  "TOPIC SHIFT (1-10): 1 = stays on the project just described. 10 = moves to a new subject or poses a hypothetical the candidate did not raise.",
  "",
  // The literal word "json" is required here: the request sets
  // response_format json_object, and OpenAI rejects that with a 400 unless
  // some message asks for JSON in so many words.
  'Reply with JSON only: {"demandingness": number, "supportiveness": number, "adaptivity": number, "topicShift": number, "reasoning": string}. Reasoning max 15 words.',
].join("\n");

/**
 * Score one follow-up, blind.
 *
 * The judge sees the exchange and the follow-up and nothing else — no persona,
 * no dial, no level, and no sibling follow-ups to rank against. Temperature 0,
 * because this is a measurement rather than a generation.
 */
async function judgeFollowup(
  followup: string,
  apiKey: string,
  usage: UsageCollector,
): Promise<{ scores: Record<JudgeAxis, number>; reasoning: string }> {
  const raw = await chat(apiKey, usage, "analyzer", JUDGE_MODEL, {
    ...completionParams(JUDGE_MODEL, { temperature: 0, maxTokens: 220 }),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: JUDGE_RUBRIC },
      {
        role: "user",
        content: [
          `QUESTION ASKED:\n${HELD_CONSTANT.question}`,
          `CANDIDATE ANSWER:\n${HELD_CONSTANT.answer}`,
          `INTERVIEWER FOLLOW-UP TO RATE:\n${followup}`,
        ].join("\n\n"),
      },
    ],
  });

  const parsed = JSON.parse(raw || "{}") as Partial<
    Record<JudgeAxis, number>
  > & { reasoning?: string };

  return {
    scores: Object.fromEntries(
      JUDGE_AXES.map((axis) => [
        axis,
        typeof parsed[axis] === "number" ? (parsed[axis] as number) : Number.NaN,
      ]),
    ) as Record<JudgeAxis, number>,
    reasoning: parsed.reasoning ?? "",
  };
}

export interface AxisResult {
  axis: JudgeAxis;
  lowMean: number;
  neutralMean: number;
  highMean: number;
  /** high minus low, the effect of turning the dial up. */
  difference: number;
  ci: [number, number];
  /** True when low ≤ neutral ≤ high, or the reverse. */
  monotonic: boolean;
  /** True when the 95% interval for the difference excludes zero. */
  separates: boolean;
}

export interface DialResult {
  dial: DialKey;
  expectation: Expectation;
  axes: AxisResult[];
  /** The axis the dial moved most, which may not be the one expected. */
  largestEffect: JudgeAxis;
  /** Whether the pre-registered expectation held. */
  expectationHeld: boolean;
}

function axisResult(
  axis: JudgeAxis,
  low: number[],
  neutral: number[],
  high: number[],
): AxisResult {
  const lowMean = mean(low);
  const highMean = mean(high);
  const neutralMean = mean(neutral);
  const difference = highMean - lowMean;

  // Two independent samples — nothing pairs a strictness-2 generation with a
  // strictness-9 one — so the interval resamples both groups, not the pairs.
  const ci = bootstrapDiffCI(low, high);

  return {
    axis,
    lowMean,
    neutralMean,
    highMean,
    difference,
    ci,
    monotonic:
      (lowMean <= neutralMean && neutralMean <= highMean) ||
      (lowMean >= neutralMean && neutralMean >= highMean),
    separates: (ci[0] > 0 && ci[1] > 0) || (ci[0] < 0 && ci[1] < 0),
  };
}

export interface ExperimentReport {
  runs: number;
  model: string;
  judgeModel: string;
  followups: Followup[];
  dials: DialResult[];
  control: { axis: JudgeAxis; mean: number; stdDev: number }[];
  errors: string[];
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Run the whole experiment.
 *
 * Cells run in sequence rather than in parallel: the bill is small, the run is
 * done once and committed, and a rate-limit retry storm mid-experiment would
 * silently change how many samples each cell actually got.
 */
export async function runExperiment(
  runs: number,
  apiKey: string,
  onProgress?: (line: string) => void,
): Promise<Omit<ExperimentReport, "costUsd" | "promptTokens" | "completionTokens"> & {
  usage: UsageCollector;
}> {
  const usage = new UsageCollector();
  const followups: Followup[] = [];
  const errors: string[] = [];
  const cells = buildCells();

  for (const cell of cells) {
    onProgress?.(`  ${cell.label}`);
    for (let run = 0; run < runs; run += 1) {
      try {
        const steer = steeringFor(cell, run);
        const text = await generate(cell, run, apiKey, usage, steer?.block ?? null);
        const { scores, reasoning } = await judgeFollowup(text, apiKey, usage);
        followups.push({
          cell: cell.label,
          dial: cell.dial,
          level: cell.level,
          run,
          strategy: steer?.strategy ?? null,
          text,
          scores,
          shape: describeShape(text),
          reasoning,
        });
      } catch (error) {
        errors.push(`${cell.label} run ${run}: ${(error as Error).message}`);
      }
    }
  }

  const at = (dial: DialKey | null, level: number | null, axis: JudgeAxis) =>
    followups
      .filter((row) => row.dial === dial && row.level === level)
      .map((row) => row.scores[axis])
      .filter((value) => Number.isFinite(value));

  const neutralFor = (axis: JudgeAxis) => at(null, 5, axis);

  const dials: DialResult[] = DIAL_KEYS.map((dial) => {
    const expectation = EXPECTATIONS[dial];
    const axes = JUDGE_AXES.map((axis) =>
      axisResult(axis, at(dial, LOW, axis), neutralFor(axis), at(dial, HIGH, axis)),
    );
    const largest = axes.reduce((best, row) =>
      Math.abs(row.difference) > Math.abs(best.difference) ? row : best,
    );
    const intended = axes.find((row) => row.axis === expectation.axis);

    return {
      dial,
      expectation,
      axes,
      largestEffect: largest.axis,
      expectationHeld:
        expectation.axis === null
          ? !axes.some((row) => row.separates)
          : Boolean(
              intended?.separates &&
                (expectation.direction === "increase"
                  ? intended.difference > 0
                  : intended.difference < 0),
            ),
    };
  });

  const control = JUDGE_AXES.map((axis) => {
    const values = at(null, null, axis);
    return { axis, mean: mean(values), stdDev: stdDev(values) };
  });

  return {
    runs,
    model: MODEL,
    judgeModel: JUDGE_MODEL,
    followups,
    dials,
    control,
    errors,
    usage,
  };
}
