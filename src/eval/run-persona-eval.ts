/**
 * Persona differentiation harness.
 *
 *   npm run eval:persona                # deterministic only, free, offline
 *   npm run eval:persona -- --live      # + generated follow-ups, costs money
 *   npm run eval:persona -- --live --runs=5
 *   npm run eval:persona -- --json
 *
 * Answers one question the project asserts everywhere and had never measured:
 * **do two different interviewers actually interview differently?**
 *
 * Deliberately split into two layers, because they carry different weight and
 * different risk:
 *
 *   1. **Deterministic** — the prompt diff and the difficulty curve. Pure
 *      functions, no network, byte-identical on every run. This is the layer to
 *      show live: it cannot fail on stage and it cannot produce a result that
 *      contradicts what you just claimed.
 *
 *   2. **Empirical** — N generated follow-ups per persona on an identical
 *      input, each scored by a judge model for how demanding it is. This is the
 *      evidence that the prompt differences reach the output. It costs money and
 *      it is stochastic, so run it beforehand and commit the result.
 *
 * The empirical layer reports **separation** — the same statistic
 * `run-eval.ts` already uses for strong-versus-weak answers — so one frame
 * covers both claims the project makes about its own behaviour.
 */

import {
  generatePersonaPrompt,
  PRESET_PERSONAS,
  type PersonaConfig,
} from "@/lib/persona-engine";
import { estimateFollowupDifficulty } from "@/lib/decision-engine";
import { UsageCollector } from "@/lib/api/token-usage";
import { formatUsd, summariseCost } from "@/lib/pricing";
import type { AnalysisResult } from "@/lib/response-analyzer";
import { makeAnalysis } from "@/lib/test-support/analysis";

const MODEL = process.env.INTERVIEWER_MODEL ?? "gpt-4o-mini";
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * The contrasting pair.
 *
 * Chosen by inspection of all six presets, not at random. Sarah Chen and Lars
 * Petersen would prove nothing — both `direct` at strictness 8, they differ in
 * a single pace sentence. These two differ on every dial and on style, so if
 * the persona system has any effect at all it shows here. If it does *not* show
 * here, it does not exist.
 */
const STRICT = PRESET_PERSONAS["yuki tanaka"];
const WARM = PRESET_PERSONAS["isabella rodriguez"];

/**
 * Held constant across both arms. Everything that could explain a difference
 * other than the persona is fixed: same question, same answer, same round.
 */
const HELD_CONSTANT = {
  question:
    "Tell me about a time you had to deliver a project with an unrealistic deadline.",
  answer:
    "We had a launch date that was pretty tight. I worked with the team and we managed to get most of it done on time. There were some things we had to cut but overall it went okay and the stakeholders were happy with the outcome.",
  scenario:
    "Practising for a Senior Product Manager role at a mid-size software company.",
};

interface JudgedTurn {
  persona: string;
  followup: string;
  demandingness: number;
  reasoning: string;
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : Number.NaN;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1),
  );
}

/** Lines present in one persona's prompt and absent from the other's. */
function promptDiff(
  a: string,
  b: string,
): { onlyA: string[]; onlyB: string[] } {
  const linesA = a.split("\n").filter(Boolean);
  const linesB = b.split("\n").filter(Boolean);
  return {
    onlyA: linesA.filter((line) => !linesB.includes(line)),
    onlyB: linesB.filter((line) => !linesA.includes(line)),
  };
}

/**
 * A middling answer, so neither persona is pinned at a ceiling or a floor.
 *
 * The answer in `HELD_CONSTANT` is genuinely mediocre — vague, unquantified,
 * "it went okay" — which is where the dials have the most room to diverge. A
 * flawless answer leaves nothing to push on, and a terrible one leaves no
 * choice about whether to.
 *
 * Built from the shared fixture rather than hand-rolled: `AnalysisResult` has
 * five nested objects, and a third independent copy would drift from the other
 * two the moment the interface changes.
 */
const MIDDLING_ANALYSIS: AnalysisResult = makeAnalysis({
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

function deterministicReport(json: boolean) {
  const strictPrompt = generatePersonaPrompt(STRICT);
  const warmPrompt = generatePersonaPrompt(WARM);
  const diff = promptDiff(strictPrompt, warmPrompt);

  const difficulty = {
    strict: estimateFollowupDifficulty(MIDDLING_ANALYSIS, {
      personaName: STRICT.name,
      strictness: STRICT.strictness,
      warmth: STRICT.warmth,
    }),
    warm: estimateFollowupDifficulty(MIDDLING_ANALYSIS, {
      personaName: WARM.name,
      strictness: WARM.strictness,
      warmth: WARM.warmth,
    }),
  };

  // Holding warmth at the neutral middle so the curve isolates strictness.
  const curve = Array.from({ length: 10 }, (_, i) => ({
    strictness: i + 1,
    difficulty: estimateFollowupDifficulty(MIDDLING_ANALYSIS, {
      personaName: "sweep",
      strictness: i + 1,
      warmth: 5,
    }),
  }));

  if (json) return { diff, difficulty, curve };

  console.log("=".repeat(72));
  console.log("DETERMINISTIC — no API calls, identical on every run");
  console.log("=".repeat(72));

  console.log(`\nHeld constant across both arms:`);
  console.log(`  question  ${HELD_CONSTANT.question}`);
  console.log(`  answer    ${HELD_CONSTANT.answer.slice(0, 68)}...`);

  console.log(`\n--- ${STRICT.name} (${STRICT.communicationStyle}) ---`);
  console.log(
    `  strictness ${STRICT.strictness} · warmth ${STRICT.warmth} · pace ${STRICT.pace} · pushback ${STRICT.pushback}`,
  );
  for (const line of diff.onlyA) console.log(`  + ${line}`);

  console.log(`\n--- ${WARM.name} (${WARM.communicationStyle}) ---`);
  console.log(
    `  strictness ${WARM.strictness} · warmth ${WARM.warmth} · pace ${WARM.pace} · pushback ${WARM.pushback}`,
  );
  for (const line of diff.onlyB) console.log(`  + ${line}`);

  console.log(`\n--- follow-up difficulty on the SAME answer ---`);
  console.log(`  ${STRICT.name.padEnd(22)} ${difficulty.strict}/10`);
  console.log(`  ${WARM.name.padEnd(22)} ${difficulty.warm}/10`);
  console.log(
    `  difference             ${difficulty.strict - difficulty.warm} points`,
  );

  console.log(`\n--- difficulty vs strictness (warmth held at 5) ---`);
  for (const point of curve) {
    console.log(
      `  strictness ${String(point.strictness).padStart(2)}  ${"█".repeat(point.difficulty)} ${point.difficulty}`,
    );
  }

  return { diff, difficulty, curve };
}

async function generateFollowup(
  persona: PersonaConfig,
  apiKey: string,
  usage: UsageCollector,
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      // The app's own interviewer temperature, so this measures the deployed
      // behaviour rather than a quieter version of it.
      temperature: 0.7,
      max_tokens: 320,
      messages: [
        {
          role: "system",
          content: [
            generatePersonaPrompt(persona),
            `\nScenario context: ${HELD_CONSTANT.scenario}`,
            "\nAsk exactly one follow-up question. Keep it to 1-3 sentences.",
          ].join("\n"),
        },
        { role: "assistant", content: HELD_CONSTANT.question },
        { role: "user", content: HELD_CONSTANT.answer },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`interviewer ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: Parameters<UsageCollector["record"]>[2];
  };
  usage.record("interviewer", MODEL, data.usage);
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Score one follow-up for how demanding it is.
 *
 * Blind by construction: the judge is never told which persona produced the
 * text, so it cannot simply agree with the label. Temperature 0 because this is
 * a measurement, not a generation.
 */
async function judge(
  followup: string,
  apiKey: string,
  usage: UsageCollector,
): Promise<{ demandingness: number; reasoning: string }> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You rate interviewer follow-up questions for how DEMANDING they are.",
            "1 = accepts the answer, encouraging, moves on.",
            "10 = challenges the claim directly, asks for evidence or numbers, probes the weakest point.",
            'Return ONLY {"demandingness": number, "reasoning": string}. Reasoning max 15 words.',
          ].join("\n"),
        },
        { role: "user", content: followup },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`judge ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: Parameters<UsageCollector["record"]>[2];
  };
  usage.record("analyzer", JUDGE_MODEL, data.usage);

  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as {
    demandingness?: number;
    reasoning?: string;
  };
  return {
    demandingness:
      typeof parsed.demandingness === "number"
        ? parsed.demandingness
        : Number.NaN,
    reasoning: parsed.reasoning ?? "",
  };
}

async function empiricalReport(runs: number, apiKey: string, json: boolean) {
  const usage = new UsageCollector();
  const turns: JudgedTurn[] = [];
  const errors: string[] = [];

  for (const persona of [STRICT, WARM]) {
    for (let i = 0; i < runs; i += 1) {
      try {
        const followup = await generateFollowup(persona, apiKey, usage);
        const verdict = await judge(followup, apiKey, usage);
        turns.push({ persona: persona.name, followup, ...verdict });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const scoresFor = (name: string) =>
    turns
      .filter((t) => t.persona === name)
      .map((t) => t.demandingness)
      .filter(Number.isFinite);

  const strictScores = scoresFor(STRICT.name);
  const warmScores = scoresFor(WARM.name);
  const cost = summariseCost(usage.all());

  const summary = {
    runs,
    strictMean: mean(strictScores),
    warmMean: mean(warmScores),
    separation: mean(strictScores) - mean(warmScores),
    strictStdDev: stdDev(strictScores),
    warmStdDev: stdDev(warmScores),
    costUsd: cost.totalUsd,
    promptTokens: cost.promptTokens,
    completionTokens: cost.completionTokens,
    errors,
  };

  if (json) return { summary, turns };

  console.log(`\n${"=".repeat(72)}`);
  console.log(
    `EMPIRICAL — ${runs} generated follow-ups per persona, blind-judged`,
  );
  console.log("=".repeat(72));

  for (const persona of [STRICT, WARM]) {
    console.log(`\n--- ${persona.name} ---`);
    for (const turn of turns.filter((t) => t.persona === persona.name)) {
      console.log(`  [${turn.demandingness}/10] ${turn.followup}`);
    }
  }

  const num = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "n/a");
  console.log(`\n--- demandingness ---`);
  console.log(
    `  ${STRICT.name.padEnd(22)} mean ${num(summary.strictMean)}  sd ${num(summary.strictStdDev)}`,
  );
  console.log(
    `  ${WARM.name.padEnd(22)} mean ${num(summary.warmMean)}  sd ${num(summary.warmStdDev)}`,
  );
  console.log(`  separation             ${num(summary.separation)} points`);
  console.log(
    `\n  cost of this run       ${formatUsd(summary.costUsd)} (${summary.promptTokens} in / ${summary.completionTokens} out)`,
  );
  if (errors.length) {
    console.log(`\n  ${errors.length} errors:`);
    for (const error of errors.slice(0, 5)) console.log(`    ${error}`);
  }

  return { summary, turns };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const runsArg = args.find((a) => a.startsWith("--runs="));
  return {
    runs: runsArg ? Math.max(1, Number(runsArg.split("=")[1]) || 3) : 3,
    json: args.includes("--json"),
    live: args.includes("--live"),
  };
}

async function main() {
  const { runs, json, live } = parseArgs();

  const deterministic = deterministicReport(json);

  if (!live) {
    if (json) console.log(JSON.stringify({ deterministic }, null, 2));
    else
      console.log(
        "\nRun with --live to generate and judge real follow-ups (costs money).",
      );
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set. --live needs it.");
    process.exitCode = 1;
    return;
  }

  const empirical = await empiricalReport(runs, apiKey, json);
  if (json) console.log(JSON.stringify({ deterministic, empirical }, null, 2));
}

void main();
