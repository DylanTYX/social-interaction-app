/**
 * Persona differentiation harness.
 *
 *   npm run eval:persona                # deterministic only, free, offline
 *   npm run eval:persona -- --live      # + the per-dial experiment, costs money
 *   npm run eval:persona -- --live --runs=5
 *   npm run eval:persona -- --live --presets   # the older two-persona arm
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { renderHtml } from "./persona-report-html";
import { provenanceLine } from "./provenance";
import { mean, stdDev } from "./stats";
import {
  DIAL_CONSUMERS,
  DIAL_KEYS,
  MIDDLING as MIDDLING_ANALYSIS,
  SWEEP_TURNS,
  pushbackThresholds,
  strategyCoverage,
  sweepAllDials,
  sweepStyles,
  type DialSweep,
} from "./persona-sweeps";
import {
  EXPECTATIONS,
  JUDGE_AXES,
  HIGH,
  LOW,
  runExperiment,
  type DialResult,
} from "./persona-experiment";
import { UsageCollector } from "@/lib/api/token-usage";
import { completionParams } from "@/lib/model-params";
import { formatUsd, summariseCost } from "@/lib/pricing";

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
const STRICT = PRESET_PERSONAS["aisyah rahman"];
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
  /**
   * Does the follow-up engage with what the candidate actually said — pick up
   * their words, probe their specific gaps — or could it have been asked of
   * any answer? The dimension the arXiv 2608.10412 study found default LLM
   * interviewers fail: acknowledgment-heavy, probe-light. Judging it needs
   * the prior Q&A as context, which HELD_CONSTANT carries.
   */
  adaptivity: number;
  reasoning: string;
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
 * Baseline for the probe rate, from the only published number the project
 * found for this behaviour: default LLM interviewers deepen on 4.9% of turns.
 */
const PROBE_BASELINE = "4.9% (arXiv 2608.10412)";

const bar = (label: string) => `\n--- ${label} ---`;

/** One dial's sweep as an aligned table, with the resolution line beneath it. */
function printDialSweep(sweep: DialSweep) {
  const consumers = DIAL_CONSUMERS[sweep.dial];
  const widths = consumers.map((consumer) =>
    Math.max(
      consumer.name.length,
      consumer.kind.length + 2,
      ...sweep.points.map((point) => point.readings[consumer.name].length),
    ),
  );

  console.log(bar(sweep.dial));
  console.log(
    `      ${consumers.map((c, i) => c.name.padEnd(widths[i])).join("  ")}`.trimEnd(),
  );
  console.log(
    `      ${consumers.map((c, i) => `(${c.kind})`.padEnd(widths[i])).join("  ")}`.trimEnd(),
  );
  for (const point of sweep.points) {
    const cells = consumers.map((c, i) => point.readings[c.name].padEnd(widths[i]));
    console.log(`  ${String(point.value).padStart(2)}  ${cells.join("  ")}`.trimEnd());
  }

  const plateaus = sweep.plateaus.length
    ? sweep.plateaus.join(", ")
    : "none — every step differs";
  const perConsumer = consumers
    .map((consumer) => `${consumer.name} ${sweep.perConsumer[consumer.name]}`)
    .join(", ");
  console.log(
    `      distinct behaviour: ${sweep.distinctQuestioning} of 10` +
      `   spoken: ${sweep.distinctExperienced} of 10` +
      `   with readouts: ${sweep.distinctOutcomes} of 10`,
  );
  console.log(`      per consumer: ${perConsumer}`);
  console.log(`      identical runs: ${plateaus}`);
  for (const consumer of consumers) {
    if (consumer.kind !== "unused") continue;
    console.log(`      note: ${consumer.name} — ${consumer.source}`);
  }
}

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

  const dials = sweepAllDials();
  const styles = sweepStyles();
  const pushbackSwitch = pushbackThresholds();
  const coverage = strategyCoverage();

  if (json)
    return {
      diff,
      difficulty,
      dials,
      styles,
      pushbackSwitch,
      coverage,
      probeBaseline: PROBE_BASELINE,
    };

  console.log("=".repeat(72));
  console.log("DETERMINISTIC — no API calls, identical on every run");
  console.log("=".repeat(72));
  console.log(provenanceLine("npm run eval:persona"));

  console.log(`\nHeld constant across both arms:`);
  console.log(`  question  ${HELD_CONSTANT.question}`);
  console.log(`  answer    ${HELD_CONSTANT.answer.slice(0, 68)}...`);

  console.log(bar(`${STRICT.name} (${STRICT.communicationStyle})`));
  console.log(
    `  strictness ${STRICT.strictness} · warmth ${STRICT.warmth} · pace ${STRICT.pace} · pushback ${STRICT.pushback}`,
  );
  for (const line of diff.onlyA) console.log(`  + ${line}`);

  console.log(bar(`${WARM.name} (${WARM.communicationStyle})`));
  console.log(
    `  strictness ${WARM.strictness} · warmth ${WARM.warmth} · pace ${WARM.pace} · pushback ${WARM.pushback}`,
  );
  for (const line of diff.onlyB) console.log(`  + ${line}`);

  console.log(bar("follow-up difficulty on the SAME answer"));
  console.log(`  ${STRICT.name.padEnd(22)} ${difficulty.strict}/10`);
  console.log(`  ${WARM.name.padEnd(22)} ${difficulty.warm}/10`);
  console.log(
    `  difference             ${difficulty.strict - difficulty.warm} points`,
  );

  console.log(`\n${"=".repeat(72)}`);
  console.log("ONE DIAL AT A TIME — others held at 5, swept 1 to 10");
  console.log("=".repeat(72));
  console.log(
    "  Two presets differ on every dial, so a difference between them cannot",
  );
  console.log(
    "  be attributed. These sweeps move one number and read every consumer of",
  );
  console.log(
    "  it. 'questioning' changes what is asked, 'delivery' how it is spoken,",
  );
  console.log(
    "  'readout' only a number on screen, and 'instruction' the text the model",
  );
  console.log(
    "  is handed — which states the dial's value, so it differs at all ten steps",
  );
  console.log("  by construction and is shown but never counted.");

  for (const sweep of dials) printDialSweep(sweep);

  console.log(
    `\n      probe-rate baseline: default LLM interviewers deepen on ${PROBE_BASELINE}`,
  );

  console.log(
    bar(`questioning style over ${SWEEP_TURNS} seeded fine-answer turns`),
  );
  for (const row of styles) {
    const mix = Object.entries(row.moveMix)
      .sort((a, b) => b[1] - a[1])
      .map(([move, count]) => `${move} ${count}`)
      .join("  ");
    console.log(
      `  ${row.style.padEnd(15)} curveballs ${(row.curveballRate * 100).toFixed(0).padStart(3)}%   ${mix}`,
    );
  }

  console.log(bar("where pushback's twist switch sits, per style"));
  console.log(
    "  twistScore = pushback - 5 + styleBias, so the same dial value means a",
  );
  console.log("  different interview under a different style.");
  for (const row of pushbackSwitch) {
    console.log(
      `  ${row.style.padEnd(15)} all pivots up to ${String(row.allPivotUntil ?? "—").padStart(2)}` +
        `   all twists from ${String(row.allTwistFrom ?? "—").padStart(2)}`,
    );
  }

  console.log(
    bar(`which moves get used, over ${coverage.decisions} decisions`),
  );
  console.log(
    "  Eight answer qualities x six styles x three depths x three",
  );
  console.log(
    "  unpredictability settings. The question is whether the interviewer has",
  );
  console.log("  more than one move, and whether a dial can reach it.");
  for (const [strategy, share] of Object.entries(coverage.shares)) {
    console.log(
      `  ${strategy.padEnd(22)} ${(share * 100).toFixed(1).padStart(5)}%  ${"█".repeat(Math.round(share * 60))}`,
    );
  }
  console.log(
    `\n  ${coverage.distinctStrategies} of 9 strategies used. But within one answer quality the move is`,
  );
  console.log(
    "  near-fixed: a weakness outranks a dial, by design. Variety across an",
  );
  console.log(
    "  interview comes from the answers changing, not from the dials.",
  );
  for (const row of coverage.byQuality) {
    console.log(`  ${row.label.padEnd(24)} ${row.strategies.join(", ")}`);
  }

  return {
    diff,
    difficulty,
    dials,
    styles,
    pushbackSwitch,
    coverage,
    probeBaseline: PROBE_BASELINE,
  };
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
      // The app's own interviewer settings, so this measures the deployed
      // behaviour rather than a quieter version of it (chat/route.ts sends
      // the same temperature / effort / cap).
      ...completionParams(MODEL, {
        temperature: 0.7,
        maxTokens: 320,
        reasoningEffort: "minimal",
      }),
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
): Promise<{ demandingness: number; adaptivity: number; reasoning: string }> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      ...completionParams(JUDGE_MODEL, { temperature: 0, maxTokens: 200 }),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You rate an interviewer's follow-up question on two independent dimensions.",
            "DEMANDING (1-10): 1 = accepts the answer, encouraging, moves on. 10 = challenges the claim directly, asks for evidence or numbers, probes the weakest point.",
            "ADAPTIVE (1-10): 1 = generic — could have been asked after any answer. 10 = engages the candidate's actual words: quotes or paraphrases their claim, probes the specific gap their answer left open.",
            // "json" must appear literally — see the note in
            // persona-experiment.ts. Its absence is why this arm 400'd.
            'Reply with JSON only: {"demandingness": number, "adaptivity": number, "reasoning": string}. Reasoning max 15 words.',
          ].join("\n"),
        },
        {
          role: "user",
          // The judge stays blind to which persona wrote the follow-up, but
          // adaptivity is meaningless without the exchange it responds to.
          content: [
            `QUESTION ASKED:\n${HELD_CONSTANT.question}`,
            `CANDIDATE ANSWER:\n${HELD_CONSTANT.answer}`,
            `INTERVIEWER FOLLOW-UP TO RATE:\n${followup}`,
          ].join("\n\n"),
        },
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
    adaptivity?: number;
    reasoning?: string;
  };
  return {
    demandingness:
      typeof parsed.demandingness === "number"
        ? parsed.demandingness
        : Number.NaN,
    adaptivity:
      typeof parsed.adaptivity === "number" ? parsed.adaptivity : Number.NaN,
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

  const scoresFor = (name: string, field: "demandingness" | "adaptivity") =>
    turns
      .filter((t) => t.persona === name)
      .map((t) => t[field])
      .filter(Number.isFinite);

  const strictScores = scoresFor(STRICT.name, "demandingness");
  const warmScores = scoresFor(WARM.name, "demandingness");
  // Adaptivity pools both arms: the claim it measures — the interviewer
  // engages with what was actually said — is about the system, not a persona.
  const adaptivityScores = [
    ...scoresFor(STRICT.name, "adaptivity"),
    ...scoresFor(WARM.name, "adaptivity"),
  ];
  const cost = summariseCost(usage.all());

  const summary = {
    runs,
    strictMean: mean(strictScores),
    warmMean: mean(warmScores),
    separation: mean(strictScores) - mean(warmScores),
    strictStdDev: stdDev(strictScores),
    warmStdDev: stdDev(warmScores),
    adaptivityMean: mean(adaptivityScores),
    adaptivityStdDev: stdDev(adaptivityScores),
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
  console.log(`\n--- adaptivity (pooled, both personas) ---`);
  console.log(
    `  mean ${num(summary.adaptivityMean)}  sd ${num(summary.adaptivityStdDev)}   (1 = generic question, 10 = engages the candidate's actual words)`,
  );
  console.log(
    `\n  cost of this run       ${formatUsd(summary.costUsd)} (${summary.promptTokens} in / ${summary.completionTokens} out)`,
  );
  if (errors.length) {
    console.log(`\n  ${errors.length} errors:`);
    for (const error of errors.slice(0, 5)) console.log(`    ${error}`);
  }

  return { summary, turns };
}

/**
 * Print one dial's live result: the pre-registered expectation, then every
 * axis, so an unintended effect is as visible as the intended one.
 */
function printDialResult(result: DialResult) {
  const { expectation } = result;
  const verdict = result.expectationHeld ? "HELD" : "NOT SHOWN";
  const target = expectation.axis
    ? `${expectation.axis} ${expectation.direction}s`
    : "no effect on any axis";

  console.log(`\n--- ${result.dial} ---`);
  console.log(`  expected: ${target}`);
  console.log(`  because:  ${expectation.why}`);
  console.log(`  verdict:  ${verdict}   largest effect: ${result.largestEffect}`);
  console.log(
    `      axis             ${String(LOW).padStart(4)}     5     ${String(HIGH).padStart(1)}    high-low   95% CI`,
  );

  for (const axis of result.axes) {
    const flag = axis.separates ? "*" : " ";
    const intended = axis.axis === expectation.axis ? "<-" : "  ";
    console.log(
      `   ${intended} ${axis.axis.padEnd(15)}` +
        `${num(axis.lowMean, 1).padStart(4)}  ` +
        `${num(axis.neutralMean, 1).padStart(4)}  ` +
        `${num(axis.highMean, 1).padStart(4)}   ` +
        `${num(axis.difference, 1).padStart(6)}${flag}  ` +
        `[${num(axis.ci[0], 1)}, ${num(axis.ci[1], 1)}]` +
        `${axis.monotonic ? "  monotonic" : ""}`,
    );
  }
}

const num = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : "n/a";

/**
 * The per-dial live experiment: one factor at a time, blind-judged.
 *
 * This is the arm that answers "does the number reach the question?". The
 * two-preset comparison (`--presets`) answers a weaker version of it and is
 * kept because the write-up already cites it.
 */
async function dialExperimentReport(runs: number, apiKey: string, json: boolean) {
  const cells = 14;
  if (!json) {
    console.log(`\n${"=".repeat(72)}`);
    console.log(
      `LIVE — ${cells} arms x ${runs} runs, one dial at a time, blind-judged`,
    );
    console.log("=".repeat(72));
  }

  const result = await runExperiment(runs, apiKey, (line) => {
    if (!json) console.log(line);
  });
  const cost = summariseCost(result.usage.all());

  const report = {
    runs: result.runs,
    model: result.model,
    judgeModel: result.judgeModel,
    dials: result.dials,
    control: result.control,
    followups: result.followups,
    errors: result.errors,
    costUsd: cost.totalUsd,
    promptTokens: cost.promptTokens,
    completionTokens: cost.completionTokens,
  };

  if (json) return report;

  console.log("\n--- control: no persona at all ---");
  for (const axis of result.control) {
    console.log(
      `  ${axis.axis.padEnd(15)} mean ${num(axis.mean, 1)}  sd ${num(axis.stdDev, 1)}`,
    );
  }

  console.log(
    `\n  Every axis is rated for every follow-up, so a dial that moves an axis`,
  );
  console.log(
    `  it was not designed to move shows up as a failure of orthogonality.`,
  );
  console.log(`  * = the 95% interval for high-low excludes zero.`);

  for (const dial of result.dials) printDialResult(dial);

  const axesRated = JUDGE_AXES.length;
  const predicted = Object.values(EXPECTATIONS).filter((e) => e.axis).length;
  console.log(
    `\n  ${predicted} of ${result.dials.length} dials predicted an effect on one of ${axesRated} axes.`,
  );
  const held = result.dials.filter((dial) => dial.expectationHeld).length;
  console.log(
    `\n  ${held} of ${result.dials.length} pre-registered expectations held.`,
  );

  console.log("\n--- what the follow-ups looked like ---");
  for (const dial of DIAL_KEYS) {
    for (const level of [LOW, HIGH]) {
      const rows = result.followups.filter(
        (row) => row.dial === dial && row.level === level,
      );
      if (!rows.length) continue;
      const echoes = rows.filter((row) => row.shape.echoesCandidate).length;
      const pivots = rows.filter((row) => row.strategy === "PIVOT_TOPIC");
      const opened = pivots.filter((row) => row.shape.opensPivotTarget).length;
      console.log(
        `  ${`${dial} ${level}`.padEnd(24)} ` +
          `${num(mean(rows.map((r) => r.shape.words)), 0).padStart(3)} words  ` +
          `${num(mean(rows.map((r) => r.shape.questions)), 1)} questions  ` +
          `${num(mean(rows.map((r) => r.shape.hedges)), 1)} hedges  ` +
          `echoes the answer ${echoes}/${rows.length}` +
          (pivots.length
            ? `   opened the pivot subject ${opened}/${pivots.length}`
            : ""),
      );
    }
  }

  console.log(
    `\n  cost of this run       ${formatUsd(report.costUsd)} (${report.promptTokens} in / ${report.completionTokens} out)`,
  );
  if (report.errors.length) {
    console.log(`\n  ${report.errors.length} errors:`);
    for (const error of report.errors.slice(0, 5)) console.log(`    ${error}`);
  }

  return report;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const runsArg = args.find((a) => a.startsWith("--runs="));
  return {
    runs: runsArg ? Math.max(1, Number(runsArg.split("=")[1]) || 3) : 3,
    json: args.includes("--json"),
    live: args.includes("--live"),
    /**
     * Write every artifact from one run.
     *
     * The convention used to be a hand-written shell redirect per file, which
     * meant the text, the JSON and the page could each come from a different
     * run of a stochastic experiment and quietly disagree. One flag, one run,
     * one set of numbers.
     */
    artifacts: args.includes("--artifacts"),
    // The original two-preset arm. Kept because the write-up cites it, but it
    // is no longer what --live runs: two personas differing on every dial
    // cannot attribute a difference to any one of them.
    presets: args.includes("--presets"),
  };
}

const ARTIFACT_DIR = "docs/artifacts";
const LIVE_JSON = `${ARTIFACT_DIR}/persona-eval-live.json`;

/** Capture stdout *and* still print it, for a reporter that runs for ages. */
function captureTee<T>(run: () => T): { value: T; text: string } {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.join(" "));
    original(...args);
  };
  try {
    return { value: run(), text: `${lines.join("\n")}\n` };
  } finally {
    console.log = original;
  }
}

/** Capture stdout while a reporter prints, so it can be written to a file. */
function capture<T>(run: () => T): { value: T; text: string } {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => void lines.push(args.join(" "));
  try {
    return { value: run(), text: `${lines.join("\n")}\n` };
  } finally {
    console.log = original;
  }
}

async function main() {
  const { runs, json, live, presets, artifacts } = parseArgs();

  if (artifacts) {
    mkdirSync(ARTIFACT_DIR, { recursive: true });

    const deterministic = capture(() => deterministicReport(false));
    writeFileSync(`${ARTIFACT_DIR}/persona-eval.txt`, deterministic.text);
    console.log(`wrote ${ARTIFACT_DIR}/persona-eval.txt`);

    let empirical: Awaited<ReturnType<typeof dialExperimentReport>> | null = null;
    if (live) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error("OPENAI_API_KEY is not set. --live needs it.");
        process.exitCode = 1;
        return;
      }
      // Progress must reach the terminal — this arm runs for half an hour and
      // a silent one cannot be told from a stalled one. So the report is
      // printed *and* captured: `capture` tees to the real console rather than
      // swallowing, and the text is written alongside the JSON. Leaving it out
      // was a quiet trap: the live text artifact kept its previous contents
      // while the JSON beside it was replaced, so the two described different
      // runs and only the timestamps said so.
      const live = await captureTee(() => dialExperimentReport(runs, apiKey, false));
      empirical = await live.value;
      writeFileSync(`${ARTIFACT_DIR}/persona-eval-live.txt`, live.text);
      console.log(`wrote ${ARTIFACT_DIR}/persona-eval-live.txt`);
      writeFileSync(
        LIVE_JSON,
        `${JSON.stringify(empirical, null, 2)}\n`,
      );
      console.log(`wrote ${LIVE_JSON}`);
    }

    /**
     * Without `--live` there is no fresh experiment, so the page falls back to
     * the committed JSON. Re-rendering a chart is a formatting change and must
     * not cost a billed run — and the alternative, silently dropping the live
     * section, replaces a page that has the numbers with one that does not.
     */
    if (!empirical && existsSync(LIVE_JSON)) {
      empirical = JSON.parse(readFileSync(LIVE_JSON, "utf8"));
      console.log(`reusing ${LIVE_JSON} (run with --live to regenerate it)`);
    }

    // The page renders from the same objects the JSON is serialised from, so
    // the two cannot disagree.
    const detJson = deterministicReport(true) as unknown as Parameters<
      typeof renderHtml
    >[0];
    writeFileSync(
      `${ARTIFACT_DIR}/persona-eval.html`,
      renderHtml(
        detJson,
        empirical as unknown as Parameters<typeof renderHtml>[1],
        provenanceLine("npm run eval:persona -- --artifacts"),
      ),
    );
    console.log(`wrote ${ARTIFACT_DIR}/persona-eval.html`);
    return;
  }


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

  const empirical = presets
    ? await empiricalReport(runs, apiKey, json)
    : await dialExperimentReport(runs, apiKey, json);
  if (json) console.log(JSON.stringify({ deterministic, empirical }, null, 2));
}

void main();
