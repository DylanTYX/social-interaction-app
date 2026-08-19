/**
 * Scoring validation harness.
 *
 *   npm run eval              # 3 runs per fixture
 *   npm run eval -- --runs=5  # more runs = tighter variance estimate
 *   npm run eval -- --json    # machine-readable, for charting
 *
 * Answers three questions the app has never been able to answer about its own
 * analyzer:
 *
 *   1. **Accuracy** — does it place an answer in the right quality band?
 *   2. **Stability** — the analyzer runs at temperature 0.1 and the code claims
 *      that makes it "near-deterministic". This measures whether that is
 *      actually true, by scoring each fixture N times and reporting the spread.
 *   3. **Completeness** — how often does the model omit a required rubric
 *      field? This is why `jsonrepair` is a dependency at all, and it has never
 *      been quantified.
 *
 * Hits the real OpenAI API, so it costs money and needs OPENAI_API_KEY.
 *
 * It now says how much. Until this change the harness called `analyzeResponse`
 * without a `UsageCollector`, so every eval run was billed and recorded nothing
 * — the one tool built to measure the analyzer could not measure its own cost.
 * The collector is never flushed to the database: these are synthetic fixtures,
 * not a user's traffic, and writing them to `llm_usage` would contaminate the
 * per-session figures the cost report reads.
 */

import { analyzeResponse, type AnalysisResult } from "@/lib/response-analyzer";
import { BAND_RANGES, FIXTURES, type EvalFixture } from "@/eval/fixtures";
import { scoreAnswerHeuristically } from "@/lib/answer-heuristics";
import { UsageCollector } from "@/lib/api/token-usage";
import { formatUsd, summariseCost } from "@/lib/pricing";

interface RunResult {
  fixture: EvalFixture;
  scores: number[];
  /** Fields the model omitted, per run. */
  missingFields: string[][];
  errors: string[];
}

const REQUIRED_FIELDS = [
  "overallScore",
  "strengths",
  "gaps",
  "followupTopics",
] as const;

function missingFrom(analysis: AnalysisResult): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const value = analysis[field as keyof AnalysisResult];
    if (value === undefined || value === null) missing.push(field);
  }
  // The analyzer fills judgement fields with neutral defaults so the product
  // never sees an undefined score, and reports what it had to fill in. Read
  // that rather than the finished object, which is complete by construction.
  missing.push(...(analysis.omittedFields ?? []));
  // Technical rounds must carry the technical block; without it the decision
  // engine falls back on overall score alone.
  const technical = ["technical_swe", "system_design", "cs_fundamentals"];
  if (
    technical.includes(analysis.roundType ?? "") &&
    !analysis.technicalScores
  ) {
    missing.push("technicalScores");
  }
  return missing;
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : Number.NaN;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function inBand(score: number, fixture: EvalFixture): boolean {
  const [lo, hi] = BAND_RANGES[fixture.band];
  return score >= lo && score <= hi;
}

async function runFixture(
  fixture: EvalFixture,
  runs: number,
  apiKey: string,
  usage: UsageCollector,
): Promise<RunResult> {
  const scores: number[] = [];
  const missingFields: string[][] = [];
  const errors: string[] = [];

  for (let i = 0; i < runs; i += 1) {
    try {
      const analysis = await analyzeResponse(
        fixture.answer,
        fixture.question,
        apiKey,
        { roundType: fixture.roundType, usage },
      );
      if (typeof analysis.overallScore === "number") {
        scores.push(analysis.overallScore);
      } else {
        errors.push("overallScore was not a number");
      }
      missingFields.push(missingFrom(analysis));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { fixture, scores, missingFields, errors };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const runsArg = args.find((a) => a.startsWith("--runs="));
  return {
    runs: runsArg ? Math.max(1, Number(runsArg.split("=")[1]) || 3) : 3,
    json: args.includes("--json"),
    only: args.find((a) => a.startsWith("--only="))?.split("=")[1],
  };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set.");
    process.exit(1);
  }

  const { runs, json, only } = parseArgs();
  const fixtures = only
    ? FIXTURES.filter((f) => f.id.includes(only) || f.roundType === only)
    : FIXTURES;

  if (fixtures.length === 0) {
    console.error(`No fixtures matched "${only}".`);
    process.exit(1);
  }

  if (!json) {
    console.log(
      `Scoring ${fixtures.length} fixtures x ${runs} runs = ${
        fixtures.length * runs
      } analyzer calls\n`,
    );
  }

  const results: RunResult[] = [];

  // One collector for the whole run. Deliberately never flushed — see the file
  // header: fixture traffic must not land in `llm_usage` beside real sessions.
  const usage = new UsageCollector();

  for (const fixture of fixtures) {
    const result = await runFixture(fixture, runs, apiKey, usage);
    results.push(result);
    if (!json) {
      const avg = mean(result.scores);
      const sd = stdDev(result.scores);
      const hits = result.scores.filter((s) => inBand(s, fixture)).length;
      const mark =
        hits === result.scores.length ? "PASS" : hits === 0 ? "FAIL" : "MIXED";
      console.log(
        `${mark.padEnd(5)} ${fixture.id.padEnd(22)} ` +
          `expected ${fixture.band.padEnd(9)} ` +
          `got ${avg.toFixed(1).padStart(5)} (sd ${sd.toFixed(1)}) ` +
          `[${result.scores.join(", ")}]`,
      );
    }
  }

  const allScores = results.flatMap((r) => r.scores);
  const totalRuns = allScores.length;
  const bandHits = results.reduce(
    (sum, r) => sum + r.scores.filter((s) => inBand(s, r.fixture)).length,
    0,
  );
  const allMissing = results.flatMap((r) => r.missingFields);
  const runsWithMissing = allMissing.filter((m) => m.length > 0).length;
  const meanSd = mean(results.map((r) => stdDev(r.scores)));
  const maxSd = Math.max(...results.map((r) => stdDev(r.scores)));

  // Separation is the headline: if strong and weak answers do not pull apart,
  // nothing else about the scoring matters.
  const strongAvg = mean(
    results.filter((r) => r.fixture.band === "strong").flatMap((r) => r.scores),
  );
  const weakAvg = mean(
    results.filter((r) => r.fixture.band === "weak").flatMap((r) => r.scores),
  );

  /**
   * Accuracy per round type.
   *
   * The headline number hid the only finding the first honest run produced:
   * weak *behavioral* answers scored 10 and 30, while weak technical, design,
   * case, screening and HR answers all landed at 53-61. One aggregate
   * percentage cannot show that; five rows can.
   */
  const byRoundType = [...new Set(fixtures.map((f) => f.roundType))]
    .map((roundType) => {
      const rows = results.filter((r) => r.fixture.roundType === roundType);
      const scores = rows.flatMap((r) => r.scores);
      const hits = rows.reduce(
        (n, r) =>
          n + r.scores.filter((score) => inBand(score, r.fixture)).length,
        0,
      );
      return {
        roundType,
        runs: scores.length,
        accuracy: scores.length ? hits / scores.length : Number.NaN,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);

  /**
   * Which way the misses go.
   *
   * "63% accurate" says nothing about direction. Every miss in the first run
   * was scored *too high* — that is a systematic leniency, which is an
   * actionable claim, where "wrong a third of the time" is not.
   */
  const misses = results.flatMap((r) =>
    r.scores
      .filter((score) => !inBand(score, r.fixture))
      .map((score) => {
        const [lo, hi] = BAND_RANGES[r.fixture.band];
        return score > hi ? "over" : score < lo ? "under" : "in";
      }),
  );
  const scoredTooHigh = misses.filter((m) => m === "over").length;
  const scoredTooLow = misses.filter((m) => m === "under").length;

  /**
   * How wide each band actually is in practice.
   *
   * Std dev measures whether one fixture scores the same twice. It says nothing
   * about whether a *band* is coherent — and "weak" spanning 10 to 61 is the
   * real problem, invisible to every metric here until now.
   */
  const bandSpread = (["weak", "mediocre", "strong"] as const).map((band) => {
    const scores = results
      .filter((r) => r.fixture.band === band)
      .flatMap((r) => r.scores);
    return {
      band,
      min: scores.length ? Math.min(...scores) : Number.NaN,
      max: scores.length ? Math.max(...scores) : Number.NaN,
      spread: scores.length
        ? Math.max(...scores) - Math.min(...scores)
        : Number.NaN,
    };
  });

  /**
   * A control condition: the same fixtures through the keyword heuristic that
   * powers the landing page's "try a question" box.
   *
   * Without it, "63%" has nothing to be good or bad *relative to*. This costs
   * no API calls — it is the same local function — and answers the obvious
   * question of whether the model is doing work a regex could do.
   */
  const baselineScore = (fixture: EvalFixture) =>
    scoreAnswerHeuristically(fixture.answer).score;

  const baselineHits = fixtures.filter((fixture) =>
    inBand(baselineScore(fixture), fixture),
  ).length;
  const baselineAccuracy = fixtures.length
    ? baselineHits / fixtures.length
    : Number.NaN;

  /**
   * The baseline's *separation*, which is the comparison that matters.
   *
   * Band accuracy is a coarse three-class metric, and the middle band is wide
   * (40-72) — so a scorer that clusters everything around 60 collects hits it
   * has not earned. The keyword heuristic does exactly that: it lands 55.6% of
   * fixtures in the right band while pulling strong and weak apart by only 13
   * points, against the analyzer's 36. Reporting accuracy alone would have
   * understated the analyzer by almost a factor of three.
   */
  const baselineStrong = mean(
    fixtures.filter((f) => f.band === "strong").map(baselineScore),
  );
  const baselineWeak = mean(
    fixtures.filter((f) => f.band === "weak").map(baselineScore),
  );
  const baselineSeparation = baselineStrong - baselineWeak;

  const summary = {
    fixtures: fixtures.length,
    runsPerFixture: runs,
    totalRuns,
    bandAccuracy: totalRuns ? bandHits / totalRuns : 0,
    meanStdDev: meanSd,
    maxStdDev: maxSd,
    strongMean: strongAvg,
    weakMean: weakAvg,
    separation: strongAvg - weakAvg,
    byRoundType,
    scoredTooHigh,
    scoredTooLow,
    bandSpread,
    baselineAccuracy,
    baselineSeparation,
    fieldCompleteness: totalRuns ? 1 - runsWithMissing / allMissing.length : 0,
    errors: results.flatMap((r) => r.errors),
    cost: (() => {
      const c = summariseCost(usage.all());
      return {
        totalUsd: c.totalUsd,
        promptTokens: c.promptTokens,
        completionTokens: c.completionTokens,
        // The number docs/EVALUATION.md wants for its unfilled before/after
        // table on moving counting out of the LLM (~296 -> ~245 scaffold
        // tokens): measured average prompt size per analyzer call.
        avgPromptTokensPerCall: totalRuns ? c.promptTokens / totalRuns : 0,
        unpricedModels: c.unpricedModels,
      };
    })(),
  };

  if (json) {
    console.log(
      JSON.stringify(
        {
          summary,
          results: results.map((r) => ({
            id: r.fixture.id,
            roundType: r.fixture.roundType,
            band: r.fixture.band,
            scores: r.scores,
            mean: mean(r.scores),
            stdDev: stdDev(r.scores),
            inBand: r.scores.filter((s) => inBand(s, r.fixture)).length,
            missingFields: r.missingFields,
            errors: r.errors,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  // `--only` can filter a band out entirely; report that rather than NaN.
  const num = (value: number, digits = 1) =>
    Number.isFinite(value) ? value.toFixed(digits) : "n/a";

  console.log("\n--- summary ---");
  // Separation leads because it is what this harness set out to test: the
  // fixtures' own docstring says the claim is "this separates a strong answer
  // from a weak one", not "this predicts 73". Band accuracy buckets that
  // judgement into three and throws the magnitude away.
  console.log(
    `Separation         ${num(summary.separation)} points  (strong ${num(summary.strongMean)} vs weak ${num(summary.weakMean)})`,
  );
  console.log(`Band accuracy      ${(summary.bandAccuracy * 100).toFixed(1)}%`);
  console.log(`Mean std dev       ${num(summary.meanStdDev, 2)} points`);
  console.log(`Worst std dev      ${num(summary.maxStdDev, 2)} points`);
  console.log(
    `Field completeness ${(summary.fieldCompleteness * 100).toFixed(1)}%`,
  );

  // Direction matters more than the rate: leniency is actionable, "wrong
  // sometimes" is not.
  if (summary.scoredTooHigh || summary.scoredTooLow) {
    console.log(
      `Misses             ${summary.scoredTooHigh} scored too high, ${summary.scoredTooLow} too low`,
    );
  }

  console.log("\nBand accuracy by round type");
  for (const row of summary.byRoundType) {
    const bar = "#"
      .repeat(Math.round((row.accuracy || 0) * 20))
      .padEnd(20, ".");
    console.log(
      `  ${row.roundType.padEnd(16)} ${bar} ${(row.accuracy * 100).toFixed(0).padStart(3)}%  (${row.runs} runs)`,
    );
  }

  console.log("\nObserved range per band");
  for (const row of summary.bandSpread) {
    const [lo, hi] = BAND_RANGES[row.band];
    console.log(
      `  ${row.band.padEnd(9)} expected ${String(lo).padStart(3)}-${String(hi).padEnd(3)}  observed ${num(row.min, 0).padStart(3)}-${num(row.max, 0).padEnd(3)}  (spread ${num(row.spread, 0)})`,
    );
  }

  console.log("\nAgainst a keyword-heuristic baseline (no API calls)");
  console.log(
    `  separation      analyzer ${num(summary.separation)}  vs baseline ${num(summary.baselineSeparation)}  (${num(summary.separation / summary.baselineSeparation, 1)}x)`,
  );
  console.log(
    `  band accuracy   analyzer ${(summary.bandAccuracy * 100).toFixed(1)}%  vs baseline ${(summary.baselineAccuracy * 100).toFixed(1)}%`,
  );
  console.log(
    `\nAvg prompt tokens  ${num(summary.cost.avgPromptTokensPerCall, 0)} per analyzer call`,
  );
  console.log(
    `Total tokens       ${summary.cost.promptTokens} in / ${summary.cost.completionTokens} out`,
  );
  console.log(`Cost of this run   ${formatUsd(summary.cost.totalUsd)}`);
  if (summary.cost.unpricedModels.length) {
    console.log(
      `  (unpriced: ${summary.cost.unpricedModels.join(", ")} — add to src/lib/pricing.ts)`,
    );
  }
  if (summary.errors.length) {
    console.log(`\n${summary.errors.length} errors:`);
    for (const error of summary.errors.slice(0, 5)) console.log(`  ${error}`);
  }
}

void main();
