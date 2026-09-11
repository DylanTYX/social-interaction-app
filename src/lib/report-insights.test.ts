import { describe, expect, it } from "vitest";

/**
 * Three of the report's four score cards were a bare number. These pin the
 * sentence each one now carries, and that a session whose analyses are
 * missing or oddly shaped gets an honest line rather than a crash.
 */

import {
  predictionDetail,
  communicationDetail,
  durationDetail,
  starDetail,
  starWeakestPart,
  technicalDetail,
} from "@/lib/report-insights";

const star = (s: number, t: number, a: number, r: number, hedges?: number) => ({
  starAnalysis: {
    situation: { quality: s },
    task: { quality: t },
    action: { quality: a },
    result: { quality: r },
  },
  ...(hedges === undefined ? {} : { confidenceIndicators: { hesitationMarkers: hedges } }),
});

describe("STAR card", () => {
  it("names the weakest part on average, with what to do about it", () => {
    const analyses = [star(8, 7, 6, 3), star(7, 8, 7, 5)];
    expect(starWeakestPart(analyses)?.part).toBe("Result");
    expect(starDetail(analyses)).toMatch(/^Result is the weakest part — end on what changed/);
  });

  it("says so when nothing was scored, including malformed analyses", () => {
    expect(starDetail([])).toMatch(/No STAR answers/);
    expect(starDetail([null, "nonsense", { starAnalysis: 5 }])).toMatch(/No STAR answers/);
  });
});

describe("technical card", () => {
  it("names the weakest technical area", () => {
    const analyses = [
      { technicalScores: { problemFraming: 8, approach: 7, edgeCases: 3 } },
      { technicalScores: { problemFraming: 9, approach: 6, edgeCases: 4 } },
    ];
    expect(technicalDetail(analyses)).toMatch(/^Edge cases is the weakest area/);
  });
});

describe("communication card", () => {
  it.each([
    [8, "Clear and assured"],
    [6, "Mostly clear"],
    [4, "Hesitant"],
  ])("describes a %s/10 average", (score, expected) => {
    expect(communicationDetail(score, [])).toContain(expected);
  });

  it("adds hedging per answer when the analyses count it", () => {
    expect(communicationDetail(6, [star(5, 5, 5, 5, 2), star(5, 5, 5, 5, 4)])).toContain("about 3 hedges an answer");
  });

  it("does not invent a verdict without a score", () => {
    expect(communicationDetail(null, [])).toMatch(/Not enough/);
  });
});

describe("duration card", () => {
  it("gives answers and time per answer", () => {
    expect(durationDetail(18, 12)).toBe("12 scored answers · about 1.5 min each.");
    expect(durationDetail(30, 1)).toBe("1 scored answer · about 30 min each.");
  });

  it("handles missing duration and no answers", () => {
    expect(durationDetail(null, 3)).toBe("3 scored answers.");
    expect(durationDetail(12, 0)).toBe("No answers were scored.");
  });
});

describe("prediction line", () => {
  it("reports the gap in either direction, and calls a near miss close", () => {
    expect(predictionDetail(72, 70.4)).toBe("You predicted 72% — close to how it went.");
    expect(predictionDetail(85, 70)).toBe("You predicted 85% — 15 points higher than you scored.");
    expect(predictionDetail(50, 70)).toBe("You predicted 50% — you did 20 points better than you thought.");
  });
});
