/**
 * One line of explanation for each score card on the report.
 *
 * Only the overall card said anything; Communication, STAR average and
 * Duration were a bare number each, so three of the four cards read as empty.
 * Everything here is derived from data the report already fetches — the
 * per-turn analyses and the session row — and says the one thing a candidate
 * can act on, rather than restating the number.
 *
 * Tolerant of shape: analyses are stored jsonb written by whatever analyzer
 * version was running, so every read is optional and a turn missing a block
 * simply does not contribute.
 */

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" ? (value as Json) : null;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

function numberAt(source: Json | null, key: string): number | null {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type StarPart = "Situation" | "Task" | "Action" | "Result";

const STAR_KEYS: Array<[StarPart, string]> = [
  ["Situation", "situation"],
  ["Task", "task"],
  ["Action", "action"],
  ["Result", "result"],
];

const STAR_ADVICE: Record<StarPart, string> = {
  Situation: "set the scene in a sentence or two",
  Task: "say what you personally were responsible for",
  Action: "say what you did, not what the team did",
  Result: "end on what changed, with a number if you can",
};

export function starWeakestPart(
  analyses: readonly unknown[],
): { part: StarPart; average: number } | null {
  let weakest: { part: StarPart; average: number } | null = null;
  for (const [part, key] of STAR_KEYS) {
    const average = mean(
      analyses.flatMap((analysis) => {
        const quality = numberAt(asObject(asObject(asObject(analysis)?.starAnalysis)?.[key]), "quality");
        return quality === null ? [] : [quality];
      }),
    );
    if (average !== null && (weakest === null || average < weakest.average)) {
      weakest = { part, average };
    }
  }
  return weakest;
}

export function starDetail(analyses: readonly unknown[]): string {
  const weakest = starWeakestPart(analyses);
  return weakest
    ? `${weakest.part} is the weakest part — ${STAR_ADVICE[weakest.part]}.`
    : "No STAR answers were scored in this session.";
}

const TECHNICAL_AREAS: Array<[string, string, string]> = [
  ["problemFraming", "Framing", "restate the problem and its constraints first"],
  ["approach", "Approach", "compare two options before committing to one"],
  ["correctness", "Correctness", "walk an example through your solution"],
  ["complexity", "Complexity", "state time and space cost as you go"],
  ["communication", "Communication", "think out loud while you work"],
  ["edgeCases", "Edge cases", "name what breaks before you are asked"],
  ["codeQuality", "Code quality", "name things clearly and keep pieces small"],
];

export function technicalWeakestArea(
  analyses: readonly unknown[],
): { area: string; advice: string; average: number } | null {
  let weakest: { area: string; advice: string; average: number } | null = null;
  for (const [key, area, advice] of TECHNICAL_AREAS) {
    const average = mean(
      analyses.flatMap((analysis) => {
        const score = numberAt(asObject(asObject(analysis)?.technicalScores), key);
        return score === null ? [] : [score];
      }),
    );
    if (average !== null && (weakest === null || average < weakest.average)) {
      weakest = { area, advice, average };
    }
  }
  return weakest;
}

export function technicalDetail(analyses: readonly unknown[]): string {
  const weakest = technicalWeakestArea(analyses);
  return weakest
    ? `${weakest.area} is the weakest area — ${weakest.advice}.`
    : "No technical answers were scored in this session.";
}

/**
 * `score` is the stored 0–10 average, shown on the card as a percentage.
 * Hedging is counted per answer from the analyzer's hesitation markers.
 */
export function communicationDetail(
  score: number | null,
  analyses: readonly unknown[],
): string {
  if (score === null) return "Not enough scored answers to judge delivery.";
  const percent = score * 10;
  const band =
    percent >= 75
      ? "Clear and assured"
      : percent >= 55
        ? "Mostly clear, with some hedging"
        : "Hesitant — hedging crept into your answers";
  const hedges = mean(
    analyses.flatMap((analysis) => {
      const count = numberAt(asObject(asObject(analysis)?.confidenceIndicators), "hesitationMarkers");
      return count === null ? [] : [count];
    }),
  );
  return hedges !== null && hedges >= 1
    ? `${band} · about ${Math.round(hedges)} hedge${Math.round(hedges) === 1 ? "" : "s"} an answer.`
    : `${band}.`;
}

export function durationDetail(
  durationMinutes: number | null,
  scoredAnswers: number,
): string {
  if (scoredAnswers <= 0) return "No answers were scored.";
  const answers = `${scoredAnswers} scored answer${scoredAnswers === 1 ? "" : "s"}`;
  if (durationMinutes === null || durationMinutes <= 0) return `${answers}.`;
  const per = durationMinutes / scoredAnswers;
  const perText = per < 10 ? per.toFixed(1).replace(/\.0$/, "") : String(Math.round(per));
  return `${answers} · about ${perText} min each.`;
}

/**
 * What a prediction made before the reveal says, next to the real score.
 * Framed as information rather than praise or blame: over- and under-rating
 * are both worth knowing about.
 */
export function predictionDetail(guess: number, score: number): string {
  const actual = Math.round(score);
  const gap = Math.abs(actual - guess);
  if (gap <= 5) return `You predicted ${guess}% — close to how it went.`;
  return guess > actual
    ? `You predicted ${guess}% — ${gap} points higher than you scored.`
    : `You predicted ${guess}% — you did ${gap} points better than you thought.`;
}
