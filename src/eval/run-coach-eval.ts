/**
 * Coaching quality harness. Full method and limitations: `docs/COACHING.md`.
 *
 *   npm run eval:coach                    # deterministic only, free, offline
 *   npm run eval:coach -- --live          # + coach and analyzer calls
 *   npm run eval:coach -- --live --runs=3
 *   npm run eval:coach -- --live --only=hr
 *   npm run eval:coach -- --live --json
 *
 * Coaching is prose, so there is no band to compare against the way
 * `run-eval.ts` compares a score. Instead the coach's output becomes an input
 * to a scorer validated earlier and separately:
 *
 *     uplift = analyzer(rewrite) − analyzer(original), paired per fixture
 *
 * The null model is the *identity coach* — a rewrite that changes nothing
 * scores zero uplift by construction — so scoring the original N times is both
 * the "before" arm and the analyzer's noise floor. Uplift below that floor
 * means nothing.
 *
 * **The judge is not independent.** It scores against the same rubric string
 * the coach is instructed with, and shares the leniency toward fluent-but-wrong
 * answers that `docs/EVALUATION.md` records. That is why the word-count and
 * correlation rows sit in the headline: read uplift beside them, never alone.
 *
 * `--live` costs money and needs OPENAI_API_KEY. The `UsageCollector` is
 * deliberately never flushed — these are synthetic fixtures, and writing them
 * to `llm_usage` would contaminate the figures `run-cost-report.ts` reads.
 */

import {
  buildCoachSystemPrompt,
  COACH_MODEL,
  requestCoaching,
  type CoachCallResult,
} from "@/lib/coach-prompt";
import { analyzeResponse } from "@/lib/response-analyzer";
import { scoreAnswerHeuristically } from "@/lib/answer-heuristics";
import {
  bandForScore,
  bandRank,
  FIXTURES,
  type EvalFixture,
  type QualityBand,
} from "@/eval/fixtures";
import { COACH_FIXTURES, type CoachFixture } from "@/eval/coach-fixtures";
import {
  bootstrapCI,
  mean,
  pairedCohensD,
  pearson,
  signTestP,
  stdDev,
} from "@/eval/stats";
import { UsageCollector } from "@/lib/api/token-usage";
import { completionParams } from "@/lib/model-params";
import { formatUsd, summariseCost } from "@/lib/pricing";
import {
  ROUND_RUBRIC_LABELS,
  ROUND_TYPES,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
import { isTechnicalRound, rubricCriteria } from "@/lib/round-types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gpt-4o-mini";

// ---------------------------------------------------------------------------
// Deterministic layer — no API calls, byte-identical on every run
// ---------------------------------------------------------------------------

/**
 * Quantities a rewrite could have taken from the candidate, or invented.
 *
 * Currency, percentages, bare numbers, spelled-out small numbers, and the
 * durations that carry a claim ("three months", "18 months"). Deliberately
 * greedy: a false positive shows up as a novel numeral to be checked by eye,
 * whereas a false negative silently passes a fabrication.
 */
function extractQuantities(text: string): string[] {
  const matches = text.match(
    /(?:[$£€]\s?\d[\d,.]*\s?[kmb]?)|(?:\d[\d,.]*\s?%)|(?:\b\d[\d,.]*\s?(?:ms|s|k|m|bn?|x)\b)|(?:\b\d[\d,.]*\b)/gi,
  );
  return [...new Set((matches ?? []).map((m) => m.trim().toLowerCase()))];
}

function normaliseFact(fact: string): string {
  return fact.toLowerCase().replace(/[\s,]/g, "");
}

/** Does the rewrite still contain a quantity the candidate actually gave? */
function retainsFact(rewrite: string, fact: string): boolean {
  return normaliseFact(rewrite).includes(normaliseFact(fact));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * The prompt this module replaced, reproduced verbatim as a control.
 *
 * `run-eval.ts` embeds the keyword heuristic for the same reason: a number with
 * nothing to be better *than* is not a result. Keeping the old builder here
 * rather than asking a reader to `git checkout` a parent commit means the
 * before/after is one command and cannot drift out of the docs.
 *
 * This is exactly `rubricGuidance` and the `systemPrompt` array as they stood
 * at `d863c5b`, in `app/api/coach/suggested-answer/route.ts`. Two branches for six
 * round types.
 */
function legacyCoachSystemPrompt(roundType: InterviewRoundType): string {
  const guidance = isTechnicalRound(roundType)
    ? `This is a ${ROUND_RUBRIC_LABELS[roundType]} question. A strong answer is structured: clarify the problem, state assumptions, reason through tradeoffs out loud, and land on a concrete approach with complexity/impact.`
    : "This is a behavioral question. A strong answer uses the STAR structure (Situation, Task, Action, Result) with a specific, first-person example and a quantified outcome.";

  return [
    "You are an expert interview coach. Given an interview question and the candidate's actual answer, produce concrete, instructive feedback.",
    guidance,
    "Return ONLY a JSON object with this exact shape:",
    '{"suggestedAnswer": string, "rewrite": string, "tips": string[]}',
    "- suggestedAnswer: an exemplary answer to the question (concise, realistic, first-person, 4-8 sentences). Invent plausible specifics where needed.",
    "- rewrite: the candidate's OWN answer improved — keep their facts and example, but tighten structure, add specificity, and fix weak spots. Do not fabricate major new achievements.",
    "- tips: 2-4 short, specific, actionable improvements (max ~12 words each).",
    "No markdown, no commentary outside the JSON.",
  ].join("\n");
}

interface RubricCoverage {
  roundType: InterviewRoundType;
  stated: number;
  total: number;
  missing: string[];
}

/**
 * How many of the criteria this round is *scored* on are named in the prompt
 * that tells the coach what to aim at.
 *
 * A drift guard within a version, and a real measurement across versions. At
 * `HEAD~1` three round types score 0 here — `screening`, `behavioral` and `hr`
 * shared one hardcoded STAR sentence that mentions none of clarity, motivation,
 * fit, concision, values fit or logistics, while the analyzer scored their
 * answers against exactly those. It cannot fail while the criteria are
 * interpolated, which is the point of keeping it.
 */
function rubricCoverage(
  build: (type: InterviewRoundType) => string,
): RubricCoverage[] {
  return ROUND_TYPES.map((roundType) => {
    const prompt = build(roundType).toLowerCase();
    const criteria = rubricCriteria(roundType);
    const missing = criteria.filter(
      (criterion) => !prompt.includes(criterion.toLowerCase()),
    );
    return {
      roundType,
      stated: criteria.length - missing.length,
      total: criteria.length,
      missing,
    };
  });
}

function deterministicReport(json: boolean) {
  const prompts = ROUND_TYPES.map((type) => ({
    roundType: type,
    prompt: buildCoachSystemPrompt(type),
  }));
  const distinct = new Set(prompts.map((p) => p.prompt)).size;
  const coverage = rubricCoverage(buildCoachSystemPrompt);

  const legacy = {
    distinct: new Set(ROUND_TYPES.map(legacyCoachSystemPrompt)).size,
    coverage: rubricCoverage(legacyCoachSystemPrompt),
  };

  // Lines shared by every round type versus lines unique to one, which is the
  // clearest way to show that the rubric block is doing work.
  const allLines = prompts.map((p) => p.prompt.split("\n").filter(Boolean));
  const shared = allLines[0].filter((line) =>
    allLines.every((lines) => lines.includes(line)),
  );
  const unique = prompts.map((p, i) => ({
    roundType: p.roundType,
    lines: allLines[i].filter((line) => !shared.includes(line)).length,
  }));

  // Characters/4 is the usual rough token estimate. Flagged as an estimate
  // because the live layer reports measured tokens and the two will differ.
  const estimatedTokens = Math.round(
    mean(prompts.map((p) => p.prompt.length / 4)),
  );

  const statedNow = coverage.reduce((s, c) => s + c.stated, 0);
  const statedBefore = legacy.coverage.reduce((s, c) => s + c.stated, 0);
  const criteriaTotal = coverage.reduce((s, c) => s + c.total, 0);

  const result = {
    distinct,
    total: ROUND_TYPES.length,
    coverage,
    unique,
    shared: shared.length,
    estimatedTokens,
    legacy,
  };
  if (json) return result;

  console.log("=".repeat(72));
  console.log("DETERMINISTIC — no API calls, identical on every run");
  console.log("=".repeat(72));
  console.log(
    "\n'before' is the two-branch prompt this replaced, reproduced verbatim in",
  );
  console.log("this file as a control. No checkout needed.");

  console.log("\nPrompt differentiation across round types");
  console.log(
    `  distinct system prompts     ${distinct} of ${ROUND_TYPES.length}        (before: ${legacy.distinct} of ${ROUND_TYPES.length})`,
  );
  console.log(`  lines shared by all six     ${shared.length}`);
  for (const entry of unique) {
    console.log(
      `  lines unique to ${entry.roundType.padEnd(14)} ${entry.lines}`,
    );
  }

  console.log(
    "\nRubric coverage — criteria from ROUND_TYPE_SPECS.rubric named in the prompt",
  );
  console.log(
    "  (the criteria the analyzer will actually score the answer on)",
  );
  console.log("");
  for (let i = 0; i < coverage.length; i += 1) {
    const now = coverage[i];
    const before = legacy.coverage[i];
    const flag = now.stated === now.total ? " " : "!";
    const moved = now.stated !== before.stated ? "  <-- was silent here" : "";
    console.log(
      `${flag} ${now.roundType.padEnd(15)} ${now.stated}/${now.total}` +
        `   (before ${before.stated}/${before.total})${moved}`,
    );
  }
  console.log(
    `\n  total                 ${statedNow}/${criteriaTotal}   (before ${statedBefore}/${criteriaTotal})`,
  );

  console.log(
    `\nEstimated system-prompt size  ~${estimatedTokens} tokens, cached per round type`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

interface Scored {
  score: number;
  gaps: string[];
}

async function score(
  text: string,
  question: string,
  roundType: InterviewRoundType,
  apiKey: string,
  usage: UsageCollector,
): Promise<Scored> {
  const analysis = await analyzeResponse(text, question, apiKey, {
    roundType,
    usage,
  });
  return { score: analysis.overallScore, gaps: analysis.gaps ?? [] };
}

/**
 * A blind judge, temperature 0.
 *
 * Told nothing about which system produced which text, and nothing about what
 * result is hoped for. The construction is copied from `run-persona-eval.ts`'s
 * demandingness judge, for the same reason: a judge that knows the hypothesis
 * is not measuring it.
 */
async function judgeJson<T>(
  system: string,
  user: string,
  apiKey: string,
  usage: UsageCollector,
  maxTokens = 300,
): Promise<T> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      ...completionParams(JUDGE_MODEL, { temperature: 0, maxTokens }),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
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

  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as T;
}

const FABRICATION_JUDGE = [
  "You compare two versions of an interview answer: an ORIGINAL and a REWRITE.",
  "List every factual claim in the REWRITE that is not supported by the ORIGINAL —",
  "invented numbers, invented outcomes, invented job titles, invented events.",
  "Rephrasing, tightening and restructuring are NOT unsupported claims.",
  "Naming something the candidate should have measured is NOT an unsupported claim,",
  "as long as no value is asserted for it.",
  'Return ONLY {"unsupportedClaims": string[], "count": number}.',
].join("\n");

const TIP_MATCH_JUDGE = [
  "You are given a list of GAPS in an interview answer, and two sets of TIPS labelled A and B.",
  "For each set independently, count how many of the listed gaps that set addresses.",
  "A gap is addressed if a tip would plausibly lead the candidate to fix it.",
  "Judge the sets independently. They come from different sources and either may be better.",
  'Return ONLY {"aCovered": number, "bCovered": number, "totalGaps": number}.',
].join("\n");

const RUBRIC_RECOVERY_JUDGE = [
  "You are given coaching feedback on an interview answer.",
  "Decide which ONE kind of interview round the coaching was written for.",
  "Options: screening, behavioral, hr, technical_swe, system_design, case.",
  'Return ONLY {"roundType": string, "confidence": number}.',
].join("\n");

interface FixtureOutcome {
  id: string;
  roundType: InterviewRoundType;
  band: QualityBand;
  originalScores: number[];
  rewriteScore: number;
  suggestedAnswerScore: number;
  uplift: number;
  originalWords: number;
  rewriteWords: number;
  factsExpected: number;
  factsRetained: number;
  novelQuantities: string[];
  unsupportedClaims: number;
  coachGapCoverage: number;
  heuristicGapCoverage: number;
  omittedFields: string[];
  repaired: boolean;
  contractWarnings: string[];
  truncated: boolean;
}

type AnyFixture = (EvalFixture | CoachFixture) & { checkableFacts?: string[] };

async function evaluateFixture(
  fixture: AnyFixture,
  runs: number,
  apiKey: string,
  usage: UsageCollector,
): Promise<FixtureOutcome> {
  // The original is scored `runs` times: it is both the "before" arm and the
  // identity-coach control, and its spread is the analyzer's noise floor.
  const originals: Scored[] = [];
  for (let i = 0; i < runs; i += 1) {
    originals.push(
      await score(
        fixture.answer,
        fixture.question,
        fixture.roundType,
        apiKey,
        usage,
      ),
    );
  }
  const originalScores = originals.map((o) => o.score);
  const gaps = originals[0].gaps;

  const coached: CoachCallResult = await requestCoaching({
    question: fixture.question,
    answer: fixture.answer,
    roundType: fixture.roundType,
    apiKey,
    usage,
  });

  const truncated = coached.finishReason === "length";
  const { rewrite, suggestedAnswer, tips } = coached.result;

  const rewriteScore = rewrite
    ? (await score(rewrite, fixture.question, fixture.roundType, apiKey, usage))
        .score
    : Number.NaN;
  const suggestedAnswerScore = suggestedAnswer
    ? (
        await score(
          suggestedAnswer,
          fixture.question,
          fixture.roundType,
          apiKey,
          usage,
        )
      ).score
    : Number.NaN;

  // Fact retention. `checkableFacts` is hand-authored ground truth where it
  // exists; otherwise fall back to the extractor, and say so in the report by
  // reporting `factsExpected` alongside.
  const expected = fixture.checkableFacts ?? extractQuantities(fixture.answer);
  const retained = rewrite
    ? expected.filter((fact) => retainsFact(rewrite, fact))
    : [];

  const originalQuantities = extractQuantities(fixture.answer).map(
    normaliseFact,
  );
  const novelQuantities = rewrite
    ? extractQuantities(rewrite).filter(
        (q) => !originalQuantities.some((o) => o.includes(normaliseFact(q))),
      )
    : [];

  let unsupportedClaims = Number.NaN;
  if (rewrite) {
    const verdict = await judgeJson<{ count?: number }>(
      FABRICATION_JUDGE,
      `ORIGINAL:\n${fixture.answer}\n\nREWRITE:\n${rewrite}`,
      apiKey,
      usage,
    );
    unsupportedClaims =
      typeof verdict.count === "number" ? verdict.count : Number.NaN;
  }

  // Tip-gap coverage, presented blind. Which set is the coach's is decided by
  // the fixture id, so the matcher cannot learn a position convention.
  let coachGapCoverage = Number.NaN;
  let heuristicGapCoverage = Number.NaN;
  const heuristicTips = scoreAnswerHeuristically(fixture.answer).tips;
  if (gaps.length > 0 && tips.length > 0) {
    const swap = bandRank(fixture.band) % 2 === 1;
    const setA = swap ? heuristicTips : tips;
    const setB = swap ? tips : heuristicTips;
    const verdict = await judgeJson<{
      aCovered?: number;
      bCovered?: number;
      totalGaps?: number;
    }>(
      TIP_MATCH_JUDGE,
      `GAPS:\n${gaps.map((g) => `- ${g}`).join("\n")}\n\nTIPS A:\n${setA
        .map((t) => `- ${t}`)
        .join("\n")}\n\nTIPS B:\n${setB.map((t) => `- ${t}`).join("\n")}`,
      apiKey,
      usage,
    );
    const total = verdict.totalGaps || gaps.length;
    const coachCovered = swap ? verdict.bCovered : verdict.aCovered;
    const heuristicCovered = swap ? verdict.aCovered : verdict.bCovered;
    coachGapCoverage = total ? (coachCovered ?? 0) / total : Number.NaN;
    heuristicGapCoverage = total ? (heuristicCovered ?? 0) / total : Number.NaN;
  }

  return {
    id: fixture.id,
    roundType: fixture.roundType,
    band: fixture.band,
    originalScores,
    rewriteScore,
    suggestedAnswerScore,
    uplift: rewriteScore - mean(originalScores),
    originalWords: wordCount(fixture.answer),
    rewriteWords: rewrite ? wordCount(rewrite) : 0,
    factsExpected: expected.length,
    factsRetained: retained.length,
    novelQuantities,
    unsupportedClaims,
    coachGapCoverage,
    heuristicGapCoverage,
    omittedFields: coached.omittedFields,
    repaired: coached.repaired,
    contractWarnings: coached.contractWarnings,
    truncated,
  };
}

/**
 * One held-constant answer, coached under all six rubrics, classified blind.
 *
 * The deterministic layer proves the *prompts* differ. This is the only thing
 * that shows the difference reaches the *output*. Chance is 1 in 6, which is
 * why it is reported as a classification rather than a separation scalar. Six
 * calls is not a sample and the limitations section says so.
 */
async function rubricRecovery(apiKey: string, usage: UsageCollector) {
  const { HELD_CONSTANT_ANSWER, HELD_CONSTANT_QUESTION } =
    await import("@/eval/coach-fixtures");

  const outcomes: { intended: string; recovered: string }[] = [];

  for (const roundType of ROUND_TYPES) {
    const coached = await requestCoaching({
      question: HELD_CONSTANT_QUESTION,
      answer: HELD_CONSTANT_ANSWER,
      roundType,
      apiKey,
      usage,
    });

    // Only the coaching is shown — never the question, never the round type.
    const verdict = await judgeJson<{ roundType?: string }>(
      RUBRIC_RECOVERY_JUDGE,
      `TIPS:\n${coached.result.tips.map((t) => `- ${t}`).join("\n")}\n\nREWRITE:\n${coached.result.rewrite}`,
      apiKey,
      usage,
      100,
    );

    outcomes.push({ intended: roundType, recovered: verdict.roundType ?? "?" });
  }

  return {
    outcomes,
    correct: outcomes.filter((o) => o.intended === o.recovered).length,
    total: outcomes.length,
  };
}

function num(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function signed(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

async function liveReport(
  fixtures: AnyFixture[],
  runs: number,
  apiKey: string,
  json: boolean,
) {
  const usage = new UsageCollector();
  const outcomes: FixtureOutcome[] = [];
  const errors: string[] = [];

  for (const fixture of fixtures) {
    try {
      outcomes.push(await evaluateFixture(fixture, runs, apiKey, usage));
    } catch (error) {
      errors.push(
        `${fixture.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const usable = outcomes.filter((o) => Number.isFinite(o.uplift));
  const uplifts = usable.map((o) => o.uplift);
  const improved = uplifts.filter((u) => u > 0).length;
  const ties = uplifts.filter((u) => u === 0).length;

  // Ties excluded and n reduced, which is the standard treatment — counting a
  // tie as a success would inflate the result.
  const p = signTestP(improved, uplifts.length - ties);
  const ci = bootstrapCI(uplifts);

  // The analyzer's test-retest spread on identical text: the floor uplift has
  // to clear before it means anything.
  const noiseFloor = mean(usable.map((o) => stdDev(o.originalScores)));

  const byBand = (["weak", "mediocre", "strong"] as QualityBand[]).map(
    (band) => {
      const rows = usable.filter((o) => o.band === band);
      return { band, n: rows.length, uplift: mean(rows.map((o) => o.uplift)) };
    },
  );

  const byRound = ROUND_TYPES.map((roundType) => {
    const rows = usable.filter((o) => o.roundType === roundType);
    return {
      roundType,
      n: rows.length,
      uplift: mean(rows.map((o) => o.uplift)),
    };
  }).filter((r) => r.n > 0);

  const wordDeltas = usable.map((o) => o.rewriteWords - o.originalWords);
  const lengthCorrelation = pearson(uplifts, wordDeltas);

  const promoted = usable.filter(
    (o) =>
      bandRank(bandForScore(o.rewriteScore)) >
      bandRank(bandForScore(mean(o.originalScores))),
  ).length;

  const modelStrong = outcomes.filter(
    (o) =>
      Number.isFinite(o.suggestedAnswerScore) &&
      bandForScore(o.suggestedAnswerScore) === "strong",
  ).length;

  const factsExpected = outcomes.reduce((s, o) => s + o.factsExpected, 0);
  const factsRetained = outcomes.reduce((s, o) => s + o.factsRetained, 0);

  const cost = summariseCost(usage.all());

  const summary = {
    fixtures: outcomes.length,
    runsPerFixture: runs,
    meanUplift: mean(uplifts),
    upliftCI: ci,
    improved,
    ties,
    signTestP: p,
    cohensDz: pairedCohensD(uplifts),
    noiseFloor,
    bandPromotions: promoted,
    suggestedAnswerStrong: modelStrong,
    byBand,
    byRound,
    meanWordDelta: mean(wordDeltas),
    lengthCorrelation,
    factRetention: factsExpected ? factsRetained / factsExpected : Number.NaN,
    novelPerRewrite: mean(outcomes.map((o) => o.novelQuantities.length)),
    unsupportedRate:
      outcomes.filter((o) => o.unsupportedClaims > 0).length /
      (outcomes.length || 1),
    coachGapCoverage: mean(
      outcomes.map((o) => o.coachGapCoverage).filter(Number.isFinite),
    ),
    heuristicGapCoverage: mean(
      outcomes.map((o) => o.heuristicGapCoverage).filter(Number.isFinite),
    ),
    fieldCompleteness:
      outcomes.filter((o) => o.omittedFields.length === 0).length /
      (outcomes.length || 1),
    repairedCount: outcomes.filter((o) => o.repaired).length,
    truncatedCount: outcomes.filter((o) => o.truncated).length,
    costUsd: cost.totalUsd,
    errors,
  };

  if (json) return { summary, outcomes };

  console.log(`\n${"=".repeat(72)}`);
  console.log(
    `LIVE — ${outcomes.length} fixtures, ${runs} original score(s) each, ${COACH_MODEL}`,
  );
  console.log("=".repeat(72));

  for (const o of outcomes) {
    console.log(
      `  ${o.id.padEnd(22)} ${o.band.padEnd(9)} orig ${num(mean(o.originalScores)).padStart(5)}   ` +
        `rewrite ${num(o.rewriteScore).padStart(5)} (${signed(o.uplift).padStart(6)})   suggested ${num(o.suggestedAnswerScore).padStart(5)}`,
    );
  }

  console.log("\n--- headline ---");
  console.log(
    `  Uplift (rewrite − original)       ${signed(summary.meanUplift)} points   95% CI [${signed(ci[0])}, ${signed(ci[1])}]`,
  );
  console.log(
    `    improved                        ${improved} of ${uplifts.length} fixtures   (exact sign test p = ${num(p, 4)})`,
  );
  console.log(
    `    effect size (Cohen's d_z)       ${num(summary.cohensDz, 2)}`,
  );
  console.log(
    `  Analyzer noise floor              ±${num(noiseFloor, 2)} sd on identical text` +
      (noiseFloor > 0
        ? `  →  uplift = ${num(Math.abs(summary.meanUplift) / noiseFloor)}× noise`
        : ""),
  );
  console.log(
    `  Band promotion rate               ${promoted} of ${usable.length} rewrites moved up a band`,
  );
  console.log(
    `  Suggested answer reaches 'strong' ${modelStrong} of ${outcomes.length}`,
  );

  console.log("\n--- uplift by band (the ceiling check) ---");
  for (const row of byBand) {
    const bars = Number.isFinite(row.uplift)
      ? Math.max(0, Math.round(row.uplift))
      : 0;
    console.log(
      `  ${row.band.padEnd(10)} (n=${row.n})   ${signed(row.uplift).padStart(6)}   ${"#".repeat(Math.min(bars, 40))}`,
    );
  }

  console.log("\n--- uplift by round type ---");
  for (const row of byRound) {
    console.log(
      `  ${row.roundType.padEnd(15)} ${signed(row.uplift).padStart(6)} (${row.n})`,
    );
  }

  console.log("\n--- or did it just make them longer? ---");
  console.log(
    `  mean word delta                   ${signed(summary.meanWordDelta, 0)} words`,
  );
  console.log(
    `  corr(uplift, word delta)          r = ${num(lengthCorrelation, 2)}    <- high r means read uplift as a length effect`,
  );

  console.log("\n--- fact preservation ---");
  console.log(
    `  candidate quantities retained     ${num(summary.factRetention * 100)}%   (${factsRetained} of ${factsExpected})`,
  );
  console.log(
    `  novel quantities per rewrite      ${num(summary.novelPerRewrite, 2)}            <- proxy for fabrication, not proof`,
  );
  const offenders = outcomes.filter((o) => o.novelQuantities.length > 2);
  if (offenders.length) {
    console.log(
      `  rewrites with >2 novel            ${offenders.length}   [${offenders.map((o) => o.id).join(", ")}]`,
    );
  }
  console.log(
    `  rewrites with an unsupported claim (blind judge)   ${num(summary.unsupportedRate * 100)}%`,
  );

  console.log("\n--- do the tips name the analyzer's gaps? ---");
  console.log(
    `  coach tips        gap coverage    ${num(summary.coachGapCoverage, 2)}`,
  );
  console.log(
    `  heuristic tips    gap coverage    ${num(summary.heuristicGapCoverage, 2)}   <- control, no API call`,
  );
  console.log(
    "  (matcher is blind: which set is the coach's varies by fixture)",
  );

  console.log("\n--- contract conformance ---");
  console.log(
    `  field completeness                ${num(summary.fieldCompleteness * 100)}%`,
  );
  console.log(`  JSON repaired by jsonrepair       ${summary.repairedCount}`);
  console.log(`  truncated (finish_reason=length)  ${summary.truncatedCount}`);
  const warned = outcomes.flatMap((o) => o.contractWarnings);
  if (warned.length) {
    console.log(`  contract warnings                 ${warned.length}`);
    for (const w of [...new Set(warned)].slice(0, 5)) console.log(`    ${w}`);
  }

  console.log(
    `\n  cost of this run                  ${formatUsd(cost.totalUsd)} (${cost.promptTokens} in / ${cost.completionTokens} out)`,
  );

  if (errors.length) {
    console.log(`\n  ${errors.length} errors:`);
    for (const error of errors.slice(0, 5)) console.log(`    ${error}`);
  }

  return { summary, outcomes };
}

// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const runsArg = args.find((a) => a.startsWith("--runs="));
  const onlyArg = args.find((a) => a.startsWith("--only="));
  return {
    runs: runsArg ? Math.max(1, Number(runsArg.split("=")[1]) || 2) : 2,
    only: onlyArg ? onlyArg.split("=")[1] : null,
    json: args.includes("--json"),
    live: args.includes("--live"),
    recovery: args.includes("--recovery"),
  };
}

async function main() {
  const { runs, only, json, live, recovery } = parseArgs();

  const deterministic = deterministicReport(json);

  if (!live) {
    if (json) console.log(JSON.stringify({ deterministic }, null, 2));
    else {
      console.log(
        "\nDeterministic layer only. Add --live to run the coach and the analyzer,",
      );
      console.log("which costs money and needs OPENAI_API_KEY.");
    }
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set. --live needs it.");
    process.exitCode = 1;
    return;
  }

  const all: AnyFixture[] = [...FIXTURES, ...COACH_FIXTURES];
  const fixtures = only
    ? all.filter((f) => f.id.includes(only) || f.roundType === only)
    : all;

  if (fixtures.length === 0) {
    console.error(`--only=${only} matched no fixtures.`);
    process.exitCode = 1;
    return;
  }

  const live_ = await liveReport(fixtures, runs, apiKey, json);

  let recovered = null;
  if (recovery) {
    const usage = new UsageCollector();
    recovered = await rubricRecovery(apiKey, usage);
    if (!json) {
      console.log(
        "\n--- round-type differentiation (one answer, six rubrics, blind judge) ---",
      );
      console.log(
        `  rubric recovered from coaching    ${recovered.correct} of ${recovered.total}      (chance 1 of ${ROUND_TYPES.length})`,
      );
      for (const o of recovered.outcomes.filter(
        (o) => o.intended !== o.recovered,
      )) {
        console.log(`    ${o.intended} -> ${o.recovered}`);
      }
    }
  }

  if (json) {
    console.log(
      JSON.stringify({ deterministic, ...live_, recovered }, null, 2),
    );
  }
}

void main();
