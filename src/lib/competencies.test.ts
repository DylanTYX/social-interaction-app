import { describe, expect, it } from "vitest";

import {
  applyCoverage,
  COMPETENCIES,
  COVERAGE_THRESHOLD,
  cosineSimilarity,
  coveragePercent,
  emptyCoverage,
  formatCoverageSteer,
  parseCoverage,
  uncoveredCompetencies,
} from "@/lib/competencies";

describe("taxonomy", () => {
  it("has unique ids", () => {
    const ids = COMPETENCIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("phrases every probe as a question-like sentence", () => {
    // Probes are compared to interviewer questions by cosine similarity, so
    // they must read like questions rather than definitions.
    for (const competency of COMPETENCIES) {
      expect(competency.probe.length).toBeGreaterThan(40);
      expect(competency.probe).toMatch(/[?.]$/);
    }
  });
});

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors and 0 for orthogonal ones", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("ignores magnitude", () => {
    expect(cosineSimilarity([1, 1], [10, 10])).toBeCloseTo(1);
  });

  it("returns 0 for mismatched or empty vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});

describe("applyCoverage", () => {
  it("marks a competency covered above the threshold", () => {
    const next = applyCoverage(emptyCoverage(), [
      { id: "conflict", similarity: COVERAGE_THRESHOLD + 0.1 },
    ]);
    expect(next.covered.conflict).toBeCloseTo(COVERAGE_THRESHOLD + 0.1);
  });

  it("leaves a weak match uncovered", () => {
    // A false positive silently defeats the point, so below-threshold matches
    // must not register.
    const next = applyCoverage(emptyCoverage(), [
      { id: "conflict", similarity: COVERAGE_THRESHOLD - 0.01 },
    ]);
    expect(next.covered).toEqual({});
  });

  it("keeps the best score seen for a competency", () => {
    let coverage = applyCoverage(emptyCoverage(), [
      { id: "failure", similarity: 0.6 },
    ]);
    coverage = applyCoverage(coverage, [{ id: "failure", similarity: 0.5 }]);
    expect(coverage.covered.failure).toBeCloseTo(0.6);

    coverage = applyCoverage(coverage, [{ id: "failure", similarity: 0.8 }]);
    expect(coverage.covered.failure).toBeCloseTo(0.8);
  });

  it("ignores unknown competency ids", () => {
    const next = applyCoverage(emptyCoverage(), [
      { id: "not-a-competency", similarity: 0.99 },
    ]);
    expect(next.covered).toEqual({});
  });

  it("does not mutate the input", () => {
    const before = emptyCoverage();
    applyCoverage(before, [{ id: "ownership", similarity: 0.9 }]);
    expect(before.covered).toEqual({});
  });
});

describe("parseCoverage", () => {
  it("survives anything previously stored", () => {
    expect(parseCoverage(null).covered).toEqual({});
    expect(parseCoverage(undefined).covered).toEqual({});
    expect(parseCoverage("nonsense").covered).toEqual({});
    expect(parseCoverage({}).covered).toEqual({});
    expect(parseCoverage({ covered: "no" }).covered).toEqual({});
  });

  it("drops ids that are no longer in the taxonomy", () => {
    // The taxonomy is code, so a stored session can reference a competency
    // that has since been renamed or removed.
    const parsed = parseCoverage({
      covered: { conflict: 0.7, retired_competency: 0.9 },
    });
    expect(parsed.covered).toEqual({ conflict: 0.7 });
  });

  it("drops non-numeric scores", () => {
    const parsed = parseCoverage({ covered: { conflict: "high" } });
    expect(parsed.covered).toEqual({});
  });
});

describe("uncoveredCompetencies and coveragePercent", () => {
  it("reports everything uncovered initially", () => {
    expect(uncoveredCompetencies(emptyCoverage())).toHaveLength(
      COMPETENCIES.length,
    );
    expect(coveragePercent(emptyCoverage())).toBe(0);
  });

  it("tracks partial coverage", () => {
    const coverage = applyCoverage(emptyCoverage(), [
      { id: COMPETENCIES[0].id, similarity: 0.9 },
      { id: COMPETENCIES[1].id, similarity: 0.9 },
    ]);

    expect(uncoveredCompetencies(coverage)).toHaveLength(
      COMPETENCIES.length - 2,
    );
    expect(coveragePercent(coverage)).toBe(
      Math.round((2 / COMPETENCIES.length) * 100),
    );
  });
});

describe("formatCoverageSteer", () => {
  it("says nothing before any question has been asked", () => {
    // With nothing covered there is no signal about what to avoid repeating —
    // steering here would just bias the opening question arbitrarily.
    expect(formatCoverageSteer(emptyCoverage())).toBeNull();
  });

  it("names specific uncovered competencies once some are covered", () => {
    const coverage = applyCoverage(emptyCoverage(), [
      { id: COMPETENCIES[0].id, similarity: 0.9 },
    ]);

    const steer = formatCoverageSteer(coverage);
    expect(steer).toContain(COMPETENCIES[1].label.toLowerCase());
    expect(steer).not.toContain(COMPETENCIES[0].label.toLowerCase());
  });

  it("says nothing once everything is covered", () => {
    const coverage = applyCoverage(
      emptyCoverage(),
      COMPETENCIES.map((c) => ({ id: c.id, similarity: 0.9 })),
    );
    expect(formatCoverageSteer(coverage)).toBeNull();
  });

  it("caps how many it names", () => {
    const coverage = applyCoverage(emptyCoverage(), [
      { id: COMPETENCIES[0].id, similarity: 0.9 },
    ]);

    const steer = formatCoverageSteer(coverage, 2) ?? "";
    const named = COMPETENCIES.filter((c) =>
      steer.includes(c.label.toLowerCase()),
    );
    expect(named).toHaveLength(2);
  });
});
