/**
 * Inter-rater agreement for the fixture labels.
 *
 *   npm run eval:raters                    # print the blind marking sheet
 *   npm run eval:raters -- --key           # print the answer key (collator only)
 *   npm run eval:raters -- --score=r.json  # report agreement from collected scores
 *
 * Every accuracy number the main harness reports is really *agreement with one
 * person* — the author wrote the answers, assigned the bands, and wrote the
 * rubric they are judged against. `docs/EVALUATION.md` has always listed that as
 * a limitation. This is the thing that removes it.
 *
 * It matters now rather than in principle. At `e50e2e4` the analyzer scores
 * 88.9% band accuracy, and every remaining miss is two fixtures that it places
 * at 50-55 against a `weak` ceiling of 45 — with standard deviations of 2.9 and
 * 0.0. A confused model would scatter. This one is consistently and confidently
 * disagreeing, which leaves two possibilities the harness cannot separate:
 *
 *   - the analyzer is too generous to a fluent, confident, wrong answer; or
 *   - the `weak` band is too harsh, and a buggy-but-running solution really is
 *     a ~52 to a human marker.
 *
 * Asking people is the only way to tell. The analyzer is entered as just
 * another rater so the same comparison applies to it — if the humans agree with
 * each other and with the model, the labels are what need moving.
 *
 * Costs nothing and calls no API: it prints text and does arithmetic.
 */

import { BAND_RANGES, FIXTURES, type QualityBand } from "@/eval/fixtures";
import { ROUND_TYPE_SPECS } from "@/lib/round-types";
import { readFileSync } from "node:fs";

/**
 * Where one band ends and the next begins, for classifying a rater's number.
 *
 * `BAND_RANGES` overlap on purpose — `weak` runs to 45 and `mediocre` starts at
 * 40 — because they express the tolerance a *label* is checked against, and a
 * scorer landing at 42 on a weak answer should not be marked wrong. That is the
 * right shape for grading the analyzer and the wrong shape for putting a
 * human's 42 into exactly one bucket, so the overlaps are split down the middle
 * here. Derived rather than written out, so moving a band moves both.
 */
const WEAK_MEDIOCRE_CUT = (BAND_RANGES.weak[1] + BAND_RANGES.mediocre[0]) / 2;
const MEDIOCRE_STRONG_CUT =
  (BAND_RANGES.mediocre[1] + BAND_RANGES.strong[0]) / 2;

const BANDS: QualityBand[] = ["weak", "mediocre", "strong"];

export function bandForScore(score: number): QualityBand {
  if (score < WEAK_MEDIOCRE_CUT) return "weak";
  if (score <= MEDIOCRE_STRONG_CUT) return "mediocre";
  return "strong";
}

/**
 * Present the fixtures in an order that hides the pattern.
 *
 * `FIXTURES` is grouped by round type and cycles strong/weak/mediocre, so a
 * rater working down it in file order can infer the intended band from the
 * position without reading the answer. A hash rather than a shuffle because
 * every rater must receive the *same* sheet — their numbers have to line up
 * when they are collated, and a re-print after a crash must not renumber.
 */
function presentationOrder<T extends { id: string }>(items: readonly T[]): T[] {
  const hash = (value: string) => {
    // FNV-1a. Any stable spread will do; this one is short and dependency-free.
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  };
  return [...items].sort((a, b) => hash(a.id) - hash(b.id));
}

function printSheet(): void {
  const ordered = presentationOrder(FIXTURES);

  console.log("# Interview answer marking sheet\n");
  console.log(
    "Score each answer from 0 to 100 for how well it answers the question asked.",
  );
  console.log(
    "Work down the sheet in order, do not skip ahead, and do not discuss with",
  );
  console.log("the other markers until every sheet is in.\n");
  console.log("Use this scale:\n");
  console.log(
    "  0-25    Does not engage the question, or shows no relevant capability.",
  );
  console.log(
    "  26-45   A real attempt that fails on fundamentals. Effort alone does not",
  );
  console.log("          lift an answer out of this band.");
  console.log("  46-65   Partially meets the question.");
  console.log("  66-80   Solid.");
  console.log("  81-100  Strong.\n");
  console.log(
    "Judge the substance, not the fluency. A confident, well-presented answer",
  );
  console.log("that is wrong belongs in the lower bands.\n");
  console.log("---\n");

  ordered.forEach((fixture, index) => {
    console.log(
      `## ${index + 1}. ${ROUND_TYPE_SPECS[fixture.roundType].label}`,
    );
    console.log(
      `\n**Rubric for this round:** ${
        ROUND_TYPE_SPECS[fixture.roundType].rubric
      }`,
    );
    console.log(`\n**Question asked**\n\n> ${fixture.question}`);
    console.log(`\n**Answer given**\n\n${fixture.answer}`);
    console.log(`\n**Your score (0-100):** ______\n`);
    console.log("---\n");
  });

  console.log(
    `${ordered.length} answers. Return your scores as a JSON object keyed by`,
  );
  console.log('question number, e.g. {"1": 55, "2": 80, ...}.');
}

function printKey(): void {
  const ordered = presentationOrder(FIXTURES);

  console.log("Answer key — for the collator only. Do not show a rater.\n");
  console.log("  #  fixture id             label     round type");
  console.log("  -  --------------------   -------   -----------");
  ordered.forEach((fixture, index) => {
    console.log(
      `  ${String(index + 1).padStart(2)} ${fixture.id.padEnd(22)} ${fixture.band.padEnd(9)} ${fixture.roundType}`,
    );
  });

  console.log(`\nCollect scores into one JSON file shaped like:\n`);
  console.log("  {");
  console.log('    "alex":     { "1": 55, "2": 80 },');
  console.log('    "sam":      { "1": 48, "2": 85 },');
  console.log('    "analyzer": { "1": 51, "2": 88 }');
  console.log("  }\n");
  console.log(
    "Enter the analyzer as a rater using its mean score from `npm run eval`.",
  );
  console.log("It is then held to exactly the same comparison as the people.");
}

type RaterScores = Record<string, Record<string, number>>;

function loadScores(path: string): RaterScores {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object of { rater: { number: score } }.");
  }
  return parsed as RaterScores;
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : Number.NaN;
}

/**
 * Cohen's kappa over the three bands.
 *
 * Raw agreement flatters a three-class problem — two raters who both call
 * everything "mediocre" agree 100% of the time and have measured nothing.
 * Kappa subtracts the agreement their individual habits would produce by
 * chance, which is the number `docs/EVALUATION.md` says a stronger design would
 * report.
 */
function cohensKappa(a: QualityBand[], b: QualityBand[]): number {
  if (a.length === 0 || a.length !== b.length) return Number.NaN;

  const observed = a.filter((band, i) => band === b[i]).length / a.length;

  const expected = BANDS.reduce((sum, band) => {
    const pa = a.filter((x) => x === band).length / a.length;
    const pb = b.filter((x) => x === band).length / b.length;
    return sum + pa * pb;
  }, 0);

  // Perfect agreement with no variation to explain: kappa is undefined rather
  // than 1, and saying so beats printing a confident 1.00.
  if (expected === 1) return Number.NaN;
  return (observed - expected) / (1 - expected);
}

function describeKappa(kappa: number): string {
  if (Number.isNaN(kappa)) return "undefined (no variation)";
  if (kappa < 0.2) return "slight";
  if (kappa < 0.4) return "fair";
  if (kappa < 0.6) return "moderate";
  if (kappa < 0.8) return "substantial";
  return "almost perfect";
}

function reportAgreement(path: string): void {
  const scores = loadScores(path);
  const ordered = presentationOrder(FIXTURES);
  const raters = Object.keys(scores);

  if (raters.length < 2) {
    console.error(
      `Only ${raters.length} rater in ${path}. Agreement needs at least two.`,
    );
    process.exitCode = 1;
    return;
  }

  // Only questions every rater answered, so no pair is compared on a different
  // subset than another. Silently dropping some would make the table dishonest,
  // so the count is printed.
  const answeredByAll = ordered
    .map((fixture, index) => ({ fixture, key: String(index + 1) }))
    .filter(({ key }) =>
      raters.every((rater) => typeof scores[rater][key] === "number"),
    );

  if (answeredByAll.length === 0) {
    console.error("No question was scored by every rater.");
    process.exitCode = 1;
    return;
  }

  const labelBands = answeredByAll.map(({ fixture }) => fixture.band);
  const bandsOf = (rater: string) =>
    answeredByAll.map(({ key }) => bandForScore(scores[rater][key]));

  console.log(
    `Inter-rater agreement over ${answeredByAll.length} of ${ordered.length} answers\n`,
  );

  console.log("Each rater against the fixture labels");
  console.log(
    "  rater            band agreement   kappa   strength        mean score",
  );
  console.log(
    "  --------------   --------------   -----   -------------   ----------",
  );
  for (const rater of raters) {
    const bands = bandsOf(rater);
    const agree = bands.filter((band, i) => band === labelBands[i]).length;
    const kappa = cohensKappa(bands, labelBands);
    const avg = mean(answeredByAll.map(({ key }) => scores[rater][key]));
    console.log(
      `  ${rater.padEnd(14)}   ${`${((agree / bands.length) * 100).toFixed(1)}%`.padStart(14)}   ${
        Number.isNaN(kappa) ? "  n/a" : kappa.toFixed(2).padStart(5)
      }   ${describeKappa(kappa).padEnd(13)}   ${avg.toFixed(1).padStart(10)}`,
    );
  }

  console.log("\nRaters against each other");
  console.log(
    "  pair                        band agreement   kappa   mean |diff|",
  );
  console.log(
    "  -------------------------   --------------   -----   -----------",
  );
  for (let i = 0; i < raters.length; i += 1) {
    for (let j = i + 1; j < raters.length; j += 1) {
      const [a, b] = [raters[i], raters[j]];
      const bandsA = bandsOf(a);
      const bandsB = bandsOf(b);
      const agree = bandsA.filter((band, k) => band === bandsB[k]).length;
      const diff = mean(
        answeredByAll.map(({ key }) =>
          Math.abs(scores[a][key] - scores[b][key]),
        ),
      );
      console.log(
        `  ${`${a} vs ${b}`.padEnd(25)}   ${`${((agree / bandsA.length) * 100).toFixed(1)}%`.padStart(14)}   ${cohensKappa(bandsA, bandsB).toFixed(2).padStart(5)}   ${diff.toFixed(1).padStart(11)}`,
      );
    }
  }

  // The point of the exercise. A fixture the people agree on and the label
  // does not is a label to move; one the people disagree on is a fixture whose
  // band was never well defined.
  console.log(
    "\nContested answers (raters agree with each other, not the label)",
  );
  let contested = 0;
  for (const { fixture, key } of answeredByAll) {
    const humanBands = raters
      .filter((rater) => rater !== "analyzer")
      .map((rater) => bandForScore(scores[rater][key]));
    if (humanBands.length < 2) continue;

    const unanimous = humanBands.every((band) => band === humanBands[0]);
    if (!unanimous || humanBands[0] === fixture.band) continue;

    contested += 1;
    const humanScores = raters
      .filter((rater) => rater !== "analyzer")
      .map((rater) => scores[rater][key]);
    console.log(
      `  ${fixture.id.padEnd(22)} labelled ${fixture.band.padEnd(9)} → raters say ${humanBands[0].padEnd(9)} (${humanScores.join(", ")})`,
    );
  }
  if (contested === 0) {
    console.log("  none — the labels survive.");
  }

  console.log("\nDisputed among the raters themselves");
  let disputed = 0;
  for (const { fixture, key } of answeredByAll) {
    const humanBands = raters
      .filter((rater) => rater !== "analyzer")
      .map((rater) => bandForScore(scores[rater][key]));
    if (humanBands.length < 2) continue;
    if (humanBands.every((band) => band === humanBands[0])) continue;

    disputed += 1;
    const humanScores = raters
      .filter((rater) => rater !== "analyzer")
      .map((rater) => `${rater} ${scores[rater][key]}`);
    console.log(`  ${fixture.id.padEnd(22)} ${humanScores.join(", ")}`);
  }
  if (disputed === 0) {
    console.log("  none.");
  }

  console.log(
    "\nReading it: where the raters agree with each other and with the analyzer",
  );
  console.log(
    "but not the label, move the band. Where they agree with the label and not",
  );
  console.log(
    "the analyzer, the prompt is what needs work. Where they disagree with each",
  );
  console.log("other, the fixture itself was never well defined.");
}

function main(): void {
  const args = process.argv.slice(2);
  const scorePath = args.find((a) => a.startsWith("--score="))?.split("=")[1];

  if (scorePath) {
    reportAgreement(scorePath);
    return;
  }
  if (args.includes("--key")) {
    printKey();
    return;
  }
  printSheet();
}

main();
