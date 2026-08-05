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
 */

import { analyzeResponse, type AnalysisResult } from "@/lib/response-analyzer";
import { BAND_RANGES, FIXTURES, type EvalFixture } from "@/eval/fixtures";

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
  const technical = ["technical_swe", "system_design", "case"];
  if (technical.includes(analysis.roundType ?? "") && !analysis.technicalScores) {
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
        { roundType: fixture.roundType },
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
  for (const fixture of fixtures) {
    const result = await runFixture(fixture, runs, apiKey);
    results.push(result);
    if (!json) {
      const avg = mean(result.scores);
      const sd = stdDev(result.scores);
      const hits = result.scores.filter((s) => inBand(s, fixture)).length;
      const mark = hits === result.scores.length ? "PASS" : hits === 0 ? "FAIL" : "MIXED";
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
    fieldCompleteness: totalRuns ? 1 - runsWithMissing / allMissing.length : 0,
    errors: results.flatMap((r) => r.errors),
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
  console.log(`Band accuracy      ${(summary.bandAccuracy * 100).toFixed(1)}%`);
  console.log(`Mean std dev       ${num(summary.meanStdDev, 2)} points`);
  console.log(`Worst std dev      ${num(summary.maxStdDev, 2)} points`);
  console.log(`Strong mean        ${num(summary.strongMean)}`);
  console.log(`Weak mean          ${num(summary.weakMean)}`);
  console.log(`Separation         ${num(summary.separation)} points`);
  console.log(
    `Field completeness ${(summary.fieldCompleteness * 100).toFixed(1)}%`,
  );
  if (summary.errors.length) {
    console.log(`\n${summary.errors.length} errors:`);
    for (const error of summary.errors.slice(0, 5)) console.log(`  ${error}`);
  }
}

void main();
