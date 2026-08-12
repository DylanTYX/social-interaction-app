import { describe, expect, it } from "vitest";

import { aggregateCoverage, COMPETENCIES } from "@/lib/competencies";

/**
 * Coverage across sessions, not within one.
 *
 * Per-session coverage answers "did this interview touch delegation?". The
 * question a candidate actually has is "what have I still never been asked
 * about?" — which needs every session at once.
 */

const [first, second] = COMPETENCIES;

describe("aggregateCoverage", () => {
  it("counts how many sessions touched each competency", () => {
    const history = aggregateCoverage([
      { covered: { [first.id]: 0.9 } },
      { covered: { [first.id]: 0.7, [second.id]: 0.5 } },
    ]);

    const byId = new Map(history.map((h) => [h.competency.id, h.sessions]));
    expect(byId.get(first.id)).toBe(2);
    expect(byId.get(second.id)).toBe(1);
  });

  it("returns every competency, including the untouched ones", () => {
    // The whole point: a competency you have never practised has to appear,
    // and it can only do so if the list is the taxonomy rather than the data.
    const history = aggregateCoverage([{ covered: { [first.id]: 0.9 } }]);

    expect(history).toHaveLength(COMPETENCIES.length);
    expect(history.filter((h) => h.sessions === 0)).toHaveLength(
      COMPETENCIES.length - 1,
    );
  });

  it("sorts rarest first, because that is the useful end", () => {
    const history = aggregateCoverage([
      { covered: { [first.id]: 0.9 } },
      { covered: { [first.id]: 0.9 } },
    ]);

    expect(history[0].sessions).toBe(0);
    expect(history[history.length - 1].competency.id).toBe(first.id);
  });

  it("tolerates sessions with no coverage recorded", () => {
    // Every session created before coverage existed, plus any whose
    // best-effort embedding call failed.
    const history = aggregateCoverage([null, undefined, {}, "nonsense"]);
    expect(history.every((h) => h.sessions === 0)).toBe(true);
  });

  it("handles an account with no sessions at all", () => {
    expect(aggregateCoverage([])).toHaveLength(COMPETENCIES.length);
  });
});
