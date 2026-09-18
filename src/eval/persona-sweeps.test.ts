/**
 * The dial sweeps are the evidence behind `docs/PERSONA-EVAL.md`, and a report
 * that quietly stops matching the code is worse than no report. These tests
 * pin the claims the document makes in prose: which dials resolve ten steps,
 * which collapse, and which never reach the prompt at all.
 *
 * A failure here is not necessarily a bug. It means a threshold moved and the
 * report now says something untrue — fix the report, then update the test.
 */

import { describe, expect, it } from "vitest";

import {
  DIAL_KEYS,
  DIAL_VALUES,
  type DialKey,
  probeRate,
  promptBand,
  pushbackThresholds,
  sweepAllDials,
  sweepDial,
  sweepStyles,
  neutralPersona,
} from "./persona-sweeps";

describe("dial sweeps", () => {
  it("is deterministic: two sweeps of the same dial agree exactly", () => {
    expect(sweepDial("unpredictability")).toEqual(sweepDial("unpredictability"));
  });

  it("no dial is inert — every one changes questioning somewhere in 1-10", () => {
    for (const sweep of sweepAllDials()) {
      expect(sweep.inertQuestioning, `${sweep.dial} changes nothing`).toBe(false);
      expect(sweep.distinctQuestioning).toBeGreaterThan(1);
    }
  });

  it("covers all six numeric dials at all ten values", () => {
    const sweeps = sweepAllDials();
    expect(sweeps.map((sweep) => sweep.dial)).toEqual([...DIAL_KEYS]);
    for (const sweep of sweeps) {
      expect(sweep.points.map((point) => point.value)).toEqual([...DIAL_VALUES]);
    }
  });
});

describe("how far each dial resolves", () => {
  /**
   * These numbers are the headline of `docs/PERSONA-EVAL.md`, and they moved
   * once already: every band dial used to resolve four or five of its ten
   * steps, because a three-band adjective cannot express ten settings. The
   * countable directives — a word budget, a specifics floor, a re-ask
   * allowance, an acknowledgement allowance, five challenge rungs — are what
   * closed the gap. A failure here means the report is now wrong.
   */
  const EXPECTED: Record<DialKey, { resolves: number; plateaus: string[] }> = {
    strictness: { resolves: 10, plateaus: [] },
    warmth: { resolves: 10, plateaus: [] },
    pace: { resolves: 10, plateaus: [] },
    pushback: { resolves: 10, plateaus: [] },
    // 6 and 7 select the same probe tier — ceil(d/10 * 7) is 5 for both — so
    // they are genuinely the same interviewer. Left as it is rather than
    // papered over with a threshold invented to reach ten.
    probingDepth: { resolves: 9, plateaus: ["6-7"] },
    unpredictability: { resolves: 10, plateaus: [] },
  };

  for (const dial of DIAL_KEYS) {
    it(`${dial} resolves ${EXPECTED[dial].resolves} of its 10 steps`, () => {
      const sweep = sweepDial(dial);
      expect(sweep.distinctQuestioning).toBe(EXPECTED[dial].resolves);
      expect(sweep.plateaus).toEqual(EXPECTED[dial].plateaus);
    });
  }

  it("resolves at least 9 steps on every dial", () => {
    for (const sweep of sweepAllDials()) {
      expect(sweep.distinctQuestioning, sweep.dial).toBeGreaterThanOrEqual(9);
    }
  });

  it("separates the ends of every dial, where a setting means most", () => {
    // 1 must not equal 2 and 9 must not equal 10. Both used to fail on
    // pushback, which is the dial whose extremes ought to be least alike.
    for (const sweep of sweepAllDials()) {
      for (const plateau of sweep.plateaus) {
        expect(plateau, `${sweep.dial} flattens its ends`).not.toBe("1-2");
        expect(plateau, `${sweep.dial} flattens its ends`).not.toBe("9-10");
      }
    }
  });

  it("does not count the instruction text towards resolution", () => {
    // The standards, pace and pushback lines state the dial's own value, so
    // the raw prompt differs at all ten steps by construction. Counting it
    // would report ten out of ten for every dial and mean nothing.
    const sweep = sweepDial("probingDepth");
    expect(sweep.perConsumer.promptDelta).toBe(10);
    expect(sweep.distinctQuestioning).toBeLessThan(10);
  });
});

describe("what each dial actually reaches", () => {
  it("tells the interviewer about five of the six dials", () => {
    const persona = neutralPersona();
    for (const dial of [
      "strictness",
      "warmth",
      "pace",
      "pushback",
      "probingDepth",
    ] as const) {
      expect(promptBand(dial, persona), dial).not.toBeNull();
    }
  });

  it("never tells it about unpredictability", () => {
    // Deliberate, and the one asymmetry left: a curveball must not be
    // announced. It arrives as a chosen strategy in the steering block, so the
    // interviewer pivots without having been primed to expect to.
    expect(promptBand("unpredictability", neutralPersona())).toBeNull();
  });

  it("pace reaches speech only — the decision engine is never told it", () => {
    const sweep = sweepDial("pace");
    expect(sweep.perConsumer.speechRate).toBe(10);
    expect(sweep.distinctExperienced).toBe(10);
    // Four prose bands, but the word budget gives a typed interview all ten.
    expect(sweep.perConsumer.prompt).toBe(4);
    expect(sweep.perConsumer.wordBudget).toBe(10);
    expect(sweep.distinctQuestioning).toBe(10);
    for (const point of sweep.points) {
      expect(point.readings.decisionEngine).toBe("not consulted");
    }
  });

  it("probe rate rises with depth and never falls", () => {
    const rates = DIAL_VALUES.map((value) => probeRate(value));
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
    expect(rates[0]).toBeLessThan(rates[rates.length - 1]);
  });
});

describe("pushback interacts with questioning style", () => {
  it("the twist switch sits at a different value under each style", () => {
    const thresholds = pushbackThresholds(200);
    const byStyle = new Map(thresholds.map((row) => [row.style, row]));

    // A stress interviewer twists from the bottom of the dial; a supportive
    // one needs it near the top. Same number, different interview.
    expect(byStyle.get("stress")?.allTwistFrom).toBeLessThan(
      byStyle.get("supportive")?.allTwistFrom ?? 11,
    );
    expect(byStyle.get("stress")?.allPivotUntil).toBeNull();
  });
});

describe("questioning style", () => {
  it("every style produces a move mix and a curveball rate", () => {
    for (const sweep of sweepStyles(40)) {
      expect(Object.keys(sweep.moveMix).length).toBeGreaterThan(0);
      expect(sweep.curveballRate).toBeGreaterThan(0);
    }
  });

  it("stress asks more curveballs than deep dive", () => {
    const byStyle = new Map(sweepStyles(200).map((row) => [row.style, row]));
    expect(byStyle.get("stress")!.curveballRate).toBeGreaterThan(
      byStyle.get("deep_dive")!.curveballRate,
    );
  });
});
