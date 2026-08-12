import { describe, expect, it } from "vitest";

import { scoreAnswerHeuristically } from "@/lib/answer-heuristics";

/**
 * The scorer behind the landing page's "try a question" box.
 *
 * It is a local keyword heuristic, not the real analyzer — but it renders a
 * 0-100 number on the same scale, and it is the first number a prospective user
 * ever sees. So it has to be hard to fool.
 */

const SALAD =
  "I led, I delivered, 40% improvement in Q3 2024, stakeholders, KPI, " +
  "ownership, impact, revenue, roadmap, delivered results, I drove, " +
  "I owned, metrics, growth, alignment, execution, outcomes";

const REAL_ANSWER =
  "Our checkout conversion dropped 12% after a release and nobody could " +
  "isolate the cause. I owned the investigation, bisected the deploys and " +
  "found a race in the payment callback. I shipped a fix within two days " +
  "and added a regression test. Conversion recovered to baseline within a " +
  "week and we have not seen it since.";

describe("scoreAnswerHeuristically", () => {
  it("refuses to reward a keyword run", () => {
    // Before the prose check this collected length + numbers + a result word +
    // two "I"s + no fillers and scored ~90.
    const result = scoreAnswerHeuristically(SALAD);
    expect(result.score).toBeLessThanOrEqual(45);
  });

  it("says why, rather than just scoring low", () => {
    const result = scoreAnswerHeuristically(SALAD);
    expect(result.tips[0]).toMatch(/full sentences/i);
    // And it does not congratulate a keyword run on its "crisp delivery".
    expect(result.strengths).toHaveLength(0);
  });

  it("scores a genuine answer well", () => {
    const result = scoreAnswerHeuristically(REAL_ANSWER);
    expect(result.score).toBeGreaterThan(70);
    expect(result.strengths.length).toBeGreaterThan(0);
  });

  it("still coaches a short answer rather than capping it", () => {
    // Under 25 words the length tip is the useful feedback; the salad ceiling
    // would only muddy it.
    const result = scoreAnswerHeuristically("I fixed the bug quickly.");
    expect(result.tips.join(" ")).toMatch(/more detail/i);
  });

  it("counts words the user actually wrote", () => {
    expect(scoreAnswerHeuristically("one two three").wordCount).toBe(3);
  });
});
