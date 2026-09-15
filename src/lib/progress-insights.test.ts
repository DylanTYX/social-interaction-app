import { describe, expect, it } from "vitest";

import {
  compareRecent,
  MIN_ANSWERS_TO_COMPARE,
  MIN_ANSWERS_TO_NAME_WEAKEST,
  MIN_POINTS_TO_COMPARE,
  sessionRoundType,
  summariseAnswers,
  summariseDelivery,
  type AnswerScoreRow,
} from "@/lib/progress-insights";
import type {
  DeliverySnapshot,
  SessionLaunchMeta,
} from "@/lib/session-launch-meta";

/**
 * The analytics page makes claims about progress. These pin the rules that
 * keep those claims honest: scores grouped by the rubric they were marked on,
 * no direction stated from too few points, a change of interviewer named, no
 * weakest part named from a tie or a handful of answers, missing judgements
 * never counted as failures, and delivery pooled by length.
 */

interface StarInput {
  s?: number;
  t?: number;
  a?: number;
  r?: number;
  quantified?: boolean;
  ownership?: number;
  specificity?: number;
  resultPresent?: boolean;
}

function star({
  s = 6,
  t = 6,
  a = 6,
  r = 6,
  quantified = true,
  ownership = 7,
  specificity = 7,
  resultPresent = true,
}: StarInput = {}): AnswerScoreRow {
  return {
    roundType: "behavioral",
    star: {
      situation: { present: true, quality: s, context: "x" },
      task: { present: true, quality: t, clarity: "x" },
      action: { present: true, quality: a, ownership, specificity },
      result: { present: resultPresent, quality: r, quantified },
    },
    technical: null,
    specificity: { concreteExamples: 1 },
    quality: { addressesExplicitly: true, thinkingVisible: true },
    omitted: [],
    notes: [],
  };
}

function launch(type: string, currentRoundIndex = 0): SessionLaunchMeta {
  return {
    interviewLoop: {
      enabled: false,
      currentRoundIndex,
      rounds: [{ type }, { type: "hr" }],
    },
  } as unknown as SessionLaunchMeta;
}

describe("sessionRoundType", () => {
  it("reads the active round, as the chat route does", () => {
    expect(sessionRoundType({ launchMeta: launch("system_design") })).toBe(
      "system_design",
    );
    expect(sessionRoundType({ launchMeta: launch("system_design", 1) })).toBe(
      "hr",
    );
  });

  it("falls back to behavioural, as the analyzer does", () => {
    expect(sessionRoundType({})).toBe("behavioral");
    expect(sessionRoundType({ launchMeta: launch("not-a-type") })).toBe(
      "behavioral",
    );
  });
});

describe("compareRecent", () => {
  const points = (scores: number[], strictness = 5, warmth = 5) =>
    scores.map((score) => ({ score, strictness, warmth }));

  it("says nothing below two groups of four", () => {
    expect(
      compareRecent(points(Array(MIN_POINTS_TO_COMPARE - 1).fill(70))),
    ).toBeNull();
  });

  it("compares the last group with the one before it", () => {
    const result = compareRecent(
      points([50, 50, 50, 50, 50, 60, 60, 60, 60, 60]),
    );
    expect(result).toMatchObject({ window: 5, recentAverage: 60, change: 10 });
    expect(result?.difficultyShift).toBeNull();
  });

  it("names a change of interviewer that could explain the change of score", () => {
    const easier = points([70, 70, 70, 70], 5, 5);
    const tougher = points([62, 62, 62, 62], 9, 3);
    expect(compareRecent([...easier, ...tougher])?.difficultyShift).toBe(
      "tougher",
    );
    expect(compareRecent([...tougher, ...easier])?.difficultyShift).toBe(
      "gentler",
    );
  });
});

describe("summariseAnswers: rubric", () => {
  it("groups answers by the rubric they were marked on, in rubric order", () => {
    const rows: AnswerScoreRow[] = [
      star(),
      {
        ...star(),
        roundType: "technical_swe",
        star: null,
        technical: { approach: 7, edgeCases: 3 },
      },
      { ...star({ s: 5 }), roundType: null },
    ];
    const summary = summariseAnswers(rows);
    const behavioural = summary.find((r) => r.roundType === "behavioral");
    const technical = summary.find((r) => r.roundType === "technical_swe");

    expect(behavioural?.answers).toBe(2);
    expect(behavioural?.criteria.map((c) => c.label)).toEqual([
      "Situation",
      "Task",
      "Action",
      "Result",
    ]);
    expect(technical?.criteria.map((c) => c.label)).toEqual([
      "Approach",
      "Edge cases",
    ]);
  });

  it("names the weakest part only with enough answers and no tie", () => {
    const few = Array.from({ length: MIN_ANSWERS_TO_NAME_WEAKEST - 1 }, () =>
      star({ r: 3 }),
    );
    expect(summariseAnswers(few)[0].weakest).toBeNull();
    expect(summariseAnswers([...few, star({ r: 3 })])[0].weakest).toMatchObject(
      { label: "Result", average: 3 },
    );
    const tied = Array.from({ length: 4 }, () => star({ s: 3, r: 3 }));
    expect(summariseAnswers(tied)[0].weakest).toBeNull();
  });

  it("does not average in a STAR block the model never filled", () => {
    const unjudged: AnswerScoreRow = {
      ...star(),
      star: {
        situation: { present: false, quality: 0, context: "" },
        task: { present: false, quality: 0, clarity: "" },
        action: { present: false, quality: 0, specificity: 0, ownership: 0 },
        result: { present: false, quality: 0, quantified: false },
      },
    };
    const [summary] = summariseAnswers([star({ r: 8 }), unjudged]);
    expect(summary.criteria.find((c) => c.key === "result")?.average).toBe(8);
    expect(summary.missing.find((m) => m.id === "no_result")?.checked).toBe(1);
  });

  it("compares newer answers with older ones only with enough of both", () => {
    // Newest first: four recent answers at Result 8, four older at Result 4.
    const rows = [
      ...Array.from({ length: 4 }, () => star({ r: 8 })),
      ...Array.from({ length: 4 }, () => star({ r: 4 })),
    ];
    expect(rows.length).toBe(MIN_ANSWERS_TO_COMPARE);
    const result = summariseAnswers(rows)[0].criteria.find(
      (c) => c.key === "result",
    );
    expect(result).toMatchObject({ change: 4, earlier: 4 });
    expect(
      summariseAnswers(rows.slice(1))[0].criteria.find(
        (c) => c.key === "result",
      )?.change,
    ).toBeNull();
  });
});

describe("summariseAnswers: what answers lacked", () => {
  it("counts the analyzer's judgements, most common first", () => {
    const rows = [
      star({ quantified: false }),
      star({ quantified: false, ownership: 3 }),
      star(),
    ];
    const [summary] = summariseAnswers(rows);
    expect(summary.missing[0]).toMatchObject({
      id: "result_unquantified",
      answers: 2,
      checked: 3,
    });
    expect(summary.missing.find((m) => m.id === "ownership")?.answers).toBe(1);
  });

  it("skips a judgement the model left out instead of counting it as missing", () => {
    const omitted: AnswerScoreRow = {
      ...star(),
      specificity: { concreteExamples: 0 },
      omitted: ["specificityMetrics.concreteExamples"],
    };
    const [summary] = summariseAnswers([omitted, star()]);
    expect(summary.missing.find((m) => m.id === "no_example")).toMatchObject({
      answers: 0,
      checked: 1,
    });
  });

  it("does not ask screening answers for a quantified result", () => {
    const [summary] = summariseAnswers([
      { ...star({ quantified: false }), roundType: "screening" },
    ]);
    expect(summary.missing.map((m) => m.id)).not.toContain(
      "result_unquantified",
    );
  });

  it("keeps the newest distinct notes", () => {
    const [summary] = summariseAnswers([
      { ...star(), notes: ["No number on the result.", "Too long."] },
      { ...star(), notes: ["no number on the result.", "Vague on your role."] },
    ]);
    expect(summary.notes).toEqual([
      "No number on the result.",
      "Too long.",
      "Vague on your role.",
    ]);
  });

  it("survives oddly shaped rows", () => {
    expect(() =>
      summariseAnswers([
        {
          roundType: "behavioral",
          star: "nope",
          technical: 4,
          specificity: null,
          quality: [],
          omitted: "x",
          notes: 3,
        },
      ]),
    ).not.toThrow();
  });
});

describe("summariseDelivery", () => {
  const answer = (
    minute: number,
    words: number,
    seconds: number,
    fillers: number,
    pauses = 0,
  ): DeliverySnapshot => ({
    wpm: Math.round((words / seconds) * 60),
    wordCount: words,
    durationSeconds: seconds,
    fillerCount: fillers,
    longPauseCount: pauses,
    recordedAt: new Date(Date.UTC(2026, 8, 1, 10, minute)).toISOString(),
  });

  it("is null with nothing saved", () => {
    expect(summariseDelivery([])).toBeNull();
  });

  it("pools by length rather than averaging answers equally", () => {
    const summary = summariseDelivery([
      answer(1, 10, 5, 1),
      answer(2, 290, 115, 2),
    ]);
    // 3 fillers in 300 words is 1 per 100, not the 5.3 an equal average gives.
    expect(summary?.recent.fillersPer100).toBe(1);
    expect(summary?.recent.fillerLabel).toBe("clean");
    expect(summary?.earlier).toBeNull();
  });

  it("compares the recent answers with the ones before once there are enough", () => {
    const earlier = Array.from({ length: 4 }, (_, i) =>
      answer(i, 100, 40, 6, 2),
    );
    const recent = Array.from({ length: 4 }, (_, i) =>
      answer(10 + i, 100, 40, 1, 0),
    );
    const summary = summariseDelivery([...recent, ...earlier]);
    expect(summary?.recent).toMatchObject({
      answers: 4,
      fillersPer100: 1,
      longPausesPerAnswer: 0,
    });
    expect(summary?.earlier).toMatchObject({
      fillersPer100: 6,
      longPausesPerAnswer: 2,
      fillerLabel: "frequent",
    });
    expect(summary?.since).toBe(earlier[0].recordedAt);
  });

  it("does not time answers too short to judge pace", () => {
    const summary = summariseDelivery([answer(1, 3, 1, 0)]);
    expect(summary?.recent.wpm).toBeNull();
    expect(summary?.recent.paceLabel).toBeNull();
  });
});
