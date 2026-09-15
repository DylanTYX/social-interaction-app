import { difficultyBias } from "@/lib/interview-difficulty";
import { isRoundType, type InterviewRoundType } from "@/lib/interview-rounds";
import { STAR_ADVICE, STAR_KEYS, TECHNICAL_AREAS } from "@/lib/report-insights";
import { isTechnicalRound } from "@/lib/round-types";
import type {
  DeliverySnapshot,
  SessionLaunchMeta,
} from "@/lib/session-launch-meta";
import {
  fillerLabelFor,
  paceFromWpm,
  type FillerLabel,
  type PaceLabel,
} from "@/lib/speech-metrics";

/**
 * What the analytics page can honestly say about progress.
 *
 * Two rules run through everything here, both taken from the project's own
 * findings rather than chosen for this page:
 *
 *   1. **Scores are compared only within a round type.** Each round type has
 *      its own rubric, so a behavioural 70 and a technical 70 measure different
 *      things. The page used to pool them into one trend line.
 *   2. **Interviewer difficulty is carried with every score.** Question
 *      difficulty scales with strictness minus warmth, so a supportive
 *      interviewer's 78 is not a demanding one's 78 (see
 *      `interview-difficulty.ts`). A change in score that coincides with a
 *      change in interviewer is said to, in words.
 *
 * Pure and tolerant of shape: the analyses are stored jsonb written by
 * whichever analyzer version was running, so every read is optional.
 */

/** Scored points before a trend line is drawn at all. */
export const MIN_POINTS_FOR_TREND = 4;

/**
 * Points before a direction is stated in words: two groups of at least four,
 * so "up on the sessions before" never compares one reading with another.
 */
export const MIN_POINTS_TO_COMPARE = MIN_POINTS_FOR_TREND * 2;

/** Scored answers of one round type before a weakest criterion is named. */
export const MIN_ANSWERS_TO_NAME_WEAKEST = 4;

/**
 * Answers before an earlier-versus-recent comparison is made: two groups of at
 * least four, the same bar as a session trend.
 */
export const MIN_ANSWERS_TO_COMPARE = MIN_POINTS_TO_COMPARE;

/** The largest group compared in "your last N sessions against the N before". */
const MAX_COMPARE_WINDOW = 5;

/**
 * A difference in average interviewer difficulty between the two compared
 * groups large enough to mention. The same step that separates one difficulty
 * band from the next in `describeDifficulty`.
 */
const DIFFICULTY_SHIFT_TO_MENTION = 0.75;

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" ? (value as Json) : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * The round type a session was scored against.
 *
 * Read from the active round of the launch setup, exactly as the chat route
 * does, and falling back to behavioural exactly as the analyzer does, so a
 * session is grouped with the rubric it was actually marked on.
 */
export function sessionRoundType(session: {
  launchMeta?: SessionLaunchMeta | null;
}): InterviewRoundType {
  const loop = session.launchMeta?.interviewLoop;
  const type = loop?.rounds?.[loop.currentRoundIndex ?? 0]?.type;
  return isRoundType(type) ? type : "behavioral";
}

export interface RecentComparison {
  /** How many sessions are in each of the two groups. */
  window: number;
  recentAverage: number;
  /** Recent group minus the group before it, in whole points. */
  change: number;
  /**
   * How the interviewers in the recent group compare with the group before:
   * "tougher" or "gentler" when the gap is a full difficulty band, else null.
   */
  difficultyShift: "tougher" | "gentler" | null;
}

/**
 * The most recent sessions against the same number just before them.
 *
 * `points` must be oldest first and already limited to one round type. Each
 * carries its interviewer's dials so a change in who was asking can be named.
 */
export function compareRecent(
  points: ReadonlyArray<{
    score: number;
    strictness?: number;
    warmth?: number;
  }>,
): RecentComparison | null {
  if (points.length < MIN_POINTS_TO_COMPARE) return null;
  const window = Math.min(MAX_COMPARE_WINDOW, Math.floor(points.length / 2));
  const recent = points.slice(-window);
  const before = points.slice(-window * 2, -window);

  const bias = (group: typeof recent) =>
    mean(group.map((point) => difficultyBias(point.strictness, point.warmth)));
  const shift = bias(recent) - bias(before);

  return {
    window,
    recentAverage: Math.round(mean(recent.map((point) => point.score))),
    change: Math.round(
      mean(recent.map((point) => point.score)) -
        mean(before.map((point) => point.score)),
    ),
    difficultyShift:
      shift >= DIFFICULTY_SHIFT_TO_MENTION
        ? "tougher"
        : shift <= -DIFFICULTY_SHIFT_TO_MENTION
          ? "gentler"
          : null,
  };
}

/** One stored answer, as the analytics endpoint reads it. Newest first. */
export interface AnswerScoreRow {
  roundType: string | null;
  star: unknown;
  technical: unknown;
  /** `analysis.specificityMetrics` */
  specificity: unknown;
  /** `analysis.responseQuality` */
  quality: unknown;
  /** `analysis.omittedFields`: judgements the model left out. */
  omitted: unknown;
  /** `analysis.gaps`: the model's own notes on what the answer lacked. */
  notes: unknown;
}

export interface CriterionAverage {
  key: string;
  label: string;
  /** What to do about it, in the report's own words. */
  advice: string;
  /** Out of 10, across every answer of this round type. */
  average: number;
  answers: number;
  /**
   * Newer half of the answers minus the older half, out of 10. Null below
   * `MIN_ANSWERS_TO_COMPARE` answers.
   */
  change: number | null;
  /** The older half's average, for the radar's earlier outline. */
  earlier: number | null;
}

/**
 * Something an answer lacked, as judged by the analyzer from its transcript.
 *
 * The page used to count fixed phrasings instead ("we decided", "significantly
 * faster"), which only fired when an answer used those exact words. These are
 * the analyzer's own judgements, made while it scored the answer and already
 * stored with it, so they follow what was actually said.
 */
export interface MissingItem {
  id: string;
  label: string;
  advice: string;
  /** Answers judged to lack it. */
  answers: number;
  /** Answers where the analyzer made this judgement at all. */
  checked: number;
}

export interface RoundBreakdown {
  roundType: InterviewRoundType;
  /** Scored answers of this round type. */
  answers: number;
  /** Rubric criteria in the rubric's own order. */
  criteria: CriterionAverage[];
  /** Named only with enough answers and a clear lowest; never a tie. */
  weakest: CriterionAverage | null;
  /** Most often missing first; only checks that were judged at least once. */
  missing: MissingItem[];
  /** The analyzer's most recent notes on what answers lacked, newest first. */
  notes: string[];
}

function part(star: unknown, key: string): Json | null {
  return asObject(asObject(star)?.[key]);
}

/**
 * Whether the STAR block holds a judgement or only the defaults written when
 * the model left it out, which are all absent, zero and empty. Checks built on
 * STAR skip an unjudged block rather than read its defaults as "missing".
 */
function starJudged(star: unknown): boolean {
  return STAR_KEYS.some(([, key]) => {
    const block = part(star, key);
    if (!block) return false;
    return Object.values(block).some(
      (value) =>
        value === true ||
        (typeof value === "number" && value > 0) ||
        (typeof value === "string" && value.trim() !== ""),
    );
  });
}

function omittedSet(row: AnswerScoreRow): Set<string> {
  return new Set(
    Array.isArray(row.omitted)
      ? row.omitted.filter(
          (field): field is string => typeof field === "string",
        )
      : [],
  );
}

interface Check {
  id: string;
  label: string;
  advice: string;
  /** True when missing, false when present, null when not judged. */
  test: (row: AnswerScoreRow, omitted: Set<string>) => boolean | null;
}

const CHECK_OFF_QUESTION: Check = {
  id: "off_question",
  label: "Drifted from the question",
  advice: "answer the question in your first sentence",
  test: (row, omitted) => {
    if (omitted.has("responseQuality.addressesExplicitly")) return null;
    const value = asObject(row.quality)?.addressesExplicitly;
    return typeof value === "boolean" ? !value : null;
  },
};

const CHECK_NO_EXAMPLE: Check = {
  id: "no_example",
  label: "No concrete example",
  advice: "anchor the answer in one real situation",
  test: (row, omitted) => {
    if (omitted.has("specificityMetrics.concreteExamples")) return null;
    const value = finiteNumber(asObject(row.specificity)?.concreteExamples);
    return value === null ? null : value === 0;
  },
};

const BEHAVIOURAL_CHECKS: Check[] = [
  {
    id: "no_result",
    label: "No outcome stated",
    advice: "end on what changed",
    test: (row) =>
      starJudged(row.star) ? part(row.star, "result")?.present === false : null,
  },
  {
    id: "result_unquantified",
    label: "Outcome without a number",
    advice: "put a number on the result",
    test: (row) => {
      const result = part(row.star, "result");
      if (!starJudged(row.star) || result?.present !== true) return null;
      return typeof result.quantified === "boolean" ? !result.quantified : null;
    },
  },
  {
    id: "ownership",
    label: "Your own part unclear",
    advice: "say what you did, not what the team did",
    test: (row) => {
      const action = part(row.star, "action");
      const ownership = finiteNumber(action?.ownership);
      if (!starJudged(row.star) || action?.present !== true) return null;
      return ownership === null ? null : ownership < 5;
    },
  },
  {
    id: "action_vague",
    label: "Actions stayed general",
    advice: "name the specific steps you took",
    test: (row) => {
      const action = part(row.star, "action");
      const specificity = finiteNumber(action?.specificity);
      if (!starJudged(row.star) || action?.present !== true) return null;
      return specificity === null ? null : specificity < 5;
    },
  },
  CHECK_NO_EXAMPLE,
  CHECK_OFF_QUESTION,
];

const TECHNICAL_CHECKS: Check[] = [
  {
    id: "thinking_hidden",
    label: "Reasoning not said out loud",
    advice: "say why as well as what",
    test: (row, omitted) => {
      if (omitted.has("responseQuality.thinkingVisible")) return null;
      const value = asObject(row.quality)?.thinkingVisible;
      return typeof value === "boolean" ? !value : null;
    },
  },
  CHECK_NO_EXAMPLE,
  CHECK_OFF_QUESTION,
];

/**
 * Screening and HR rounds are scored on the behavioural schema, but "put a
 * number on the result" is not advice for "why do you want to work here?", so
 * they get only the checks that fit any answer.
 */
const CONVERSATIONAL_CHECKS: Check[] = [CHECK_NO_EXAMPLE, CHECK_OFF_QUESTION];

function checksFor(type: InterviewRoundType): Check[] {
  if (isTechnicalRound(type)) return TECHNICAL_CHECKS;
  return type === "behavioral" ? BEHAVIOURAL_CHECKS : CONVERSATIONAL_CHECKS;
}

/** One criterion's values across rows, clamped to the 0–10 scale. */
function criterionValues(
  rows: readonly AnswerScoreRow[],
  read: (row: AnswerScoreRow) => unknown,
): number[] {
  return rows.flatMap((row) => {
    const value = finiteNumber(read(row));
    return value === null ? [] : [Math.max(0, Math.min(10, value))];
  });
}

function buildCriteria(
  type: InterviewRoundType,
  rows: readonly AnswerScoreRow[],
): CriterionAverage[] {
  const definitions: Array<{
    key: string;
    label: string;
    advice: string;
    read: (row: AnswerScoreRow) => unknown;
  }> = isTechnicalRound(type)
    ? TECHNICAL_AREAS.map(([key, label, advice]) => ({
        key,
        label,
        advice,
        read: (row) => asObject(row.technical)?.[key],
      }))
    : STAR_KEYS.map(([label, key]) => ({
        key,
        label,
        advice: STAR_ADVICE[label],
        // An unjudged STAR block is all zeros; averaging it in would drag
        // every part down for answers the model never marked.
        read: (row) =>
          starJudged(row.star) ? part(row.star, key)?.quality : undefined,
      }));

  // Rows arrive newest first, so the first half is the recent one.
  const half = Math.floor(rows.length / 2);
  const comparable = rows.length >= MIN_ANSWERS_TO_COMPARE;

  return definitions.flatMap(({ key, label, advice, read }) => {
    const all = criterionValues(rows, read);
    if (all.length === 0) return [];
    const recent = comparable ? criterionValues(rows.slice(0, half), read) : [];
    const older = comparable
      ? criterionValues(rows.slice(rows.length - half), read)
      : [];
    const hasBoth = recent.length > 0 && older.length > 0;
    return [
      {
        key,
        label,
        advice,
        average: mean(all),
        answers: all.length,
        change: hasBoth
          ? Math.round((mean(recent) - mean(older)) * 10) / 10
          : null,
        earlier: hasBoth ? mean(older) : null,
      },
    ];
  });
}

function buildMissing(
  type: InterviewRoundType,
  rows: readonly AnswerScoreRow[],
): MissingItem[] {
  return checksFor(type)
    .map((check) => {
      let answers = 0;
      let checked = 0;
      for (const row of rows) {
        const verdict = check.test(row, omittedSet(row));
        if (verdict === null) continue;
        checked += 1;
        if (verdict) answers += 1;
      }
      return {
        id: check.id,
        label: check.label,
        advice: check.advice,
        answers,
        checked,
      };
    })
    .filter((item) => item.checked > 0)
    .sort((a, b) => b.answers / b.checked - a.answers / a.checked);
}

/** How many of the analyzer's notes to show, newest first. */
const MAX_NOTES = 3;
const MAX_NOTE_CHARS = 180;

function buildNotes(rows: readonly AnswerScoreRow[]): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const row of rows) {
    if (!Array.isArray(row.notes)) continue;
    for (const raw of row.notes) {
      if (typeof raw !== "string") continue;
      const note = raw.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_CHARS);
      const key = note.toLocaleLowerCase();
      if (!note || seen.has(key)) continue;
      seen.add(key);
      notes.push(note);
      if (notes.length >= MAX_NOTES) return notes;
    }
  }
  return notes;
}

/**
 * Every stored answer, grouped by the rubric it was marked on.
 *
 * `rows` must be newest first, as the endpoint reads them. Behavioural round
 * types read the STAR part scores and technical ones the seven technical
 * criteria; which set applies follows the round type, as it does in the
 * analyzer. A null round type is behavioural, the analyzer's fallback. Round
 * types with no rows are omitted.
 */
export function summariseAnswers(
  rows: readonly AnswerScoreRow[],
): RoundBreakdown[] {
  const byType = new Map<InterviewRoundType, AnswerScoreRow[]>();
  for (const row of rows) {
    const type = isRoundType(row.roundType) ? row.roundType : "behavioral";
    const group = byType.get(type) ?? [];
    group.push(row);
    byType.set(type, group);
  }

  return [...byType.entries()]
    .map(([roundType, group]) => {
      const criteria = buildCriteria(roundType, group);
      const sorted = [...criteria].sort((a, b) => a.average - b.average);
      const lowest = sorted[0];
      const tied =
        lowest !== undefined &&
        sorted.filter((criterion) => criterion.average === lowest.average)
          .length > 1;

      return {
        roundType,
        answers: group.length,
        criteria,
        weakest:
          lowest && !tied && group.length >= MIN_ANSWERS_TO_NAME_WEAKEST
            ? lowest
            : null,
        missing: buildMissing(roundType, group),
        notes: buildNotes(group),
      };
    })
    .sort((a, b) => b.answers - a.answers);
}

export interface DeliveryFigures {
  /** Words per minute pooled over answers long enough to time; null if none. */
  wpm: number | null;
  paceLabel: PaceLabel | null;
  /** Filler words per 100 words, pooled so long answers weigh more. */
  fillersPer100: number | null;
  fillerLabel: FillerLabel | null;
  longPausesPerAnswer: number | null;
  answers: number;
}

export interface DeliverySummary {
  /** Every saved spoken answer considered. */
  answers: number;
  /** The most recent answers, up to `DELIVERY_WINDOW`. */
  recent: DeliveryFigures;
  /** The same number of answers just before, when there are enough. */
  earlier: DeliveryFigures | null;
  /** When the oldest saved answer was spoken. */
  since: string | null;
}

/** Spoken answers the headline delivery figures are taken over. */
export const DELIVERY_WINDOW = 10;

/** Below this many words or seconds an answer is too short to time. */
const MIN_WORDS_TO_TIME = 5;
const MIN_SECONDS_TO_TIME = 2;

function deliveryFigures(
  snapshots: readonly DeliverySnapshot[],
): DeliveryFigures {
  const timed = snapshots.filter(
    (entry) =>
      entry.wordCount >= MIN_WORDS_TO_TIME &&
      entry.durationSeconds >= MIN_SECONDS_TO_TIME,
  );
  const timedWords = timed.reduce((sum, entry) => sum + entry.wordCount, 0);
  const timedSeconds = timed.reduce(
    (sum, entry) => sum + entry.durationSeconds,
    0,
  );
  const wpm =
    timedSeconds > 0 ? Math.round((timedWords / timedSeconds) * 60) : null;

  const words = snapshots.reduce((sum, entry) => sum + entry.wordCount, 0);
  const fillers = snapshots.reduce((sum, entry) => sum + entry.fillerCount, 0);
  const fillersPer100 =
    words > 0 ? Math.round((fillers / words) * 1000) / 10 : null;

  return {
    wpm,
    paceLabel: paceFromWpm(wpm),
    fillersPer100,
    fillerLabel: fillersPer100 === null ? null : fillerLabelFor(fillersPer100),
    longPausesPerAnswer: snapshots.length
      ? Math.round(
          (snapshots.reduce((sum, entry) => sum + entry.longPauseCount, 0) /
            snapshots.length) *
            10,
        ) / 10
      : null,
    answers: snapshots.length,
  };
}

/**
 * Pace, filler words and long pauses across saved spoken answers.
 *
 * Pooled rather than averaged per answer: a ten-second answer with one "um"
 * is ten fillers per hundred words, and averaging it equally with a two-minute
 * answer would say more about the short one than about the speaker. The
 * bands are the live interview's own (`paceFromWpm`, `fillerLabelFor`).
 */
export function summariseDelivery(
  snapshots: readonly DeliverySnapshot[],
): DeliverySummary | null {
  if (snapshots.length === 0) return null;
  const ordered = [...snapshots].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt),
  );
  const window = Math.min(
    DELIVERY_WINDOW,
    ordered.length >= MIN_ANSWERS_TO_COMPARE
      ? Math.floor(ordered.length / 2)
      : ordered.length,
  );
  const recent = ordered.slice(-window);
  const earlier =
    ordered.length >= MIN_ANSWERS_TO_COMPARE
      ? ordered.slice(-window * 2, -window)
      : null;

  return {
    answers: ordered.length,
    recent: deliveryFigures(recent),
    earlier: earlier ? deliveryFigures(earlier) : null,
    since: ordered[0].recordedAt,
  };
}
