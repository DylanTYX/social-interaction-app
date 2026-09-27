import { describe, expect, it } from "vitest";

/**
 * The landing page's follow-up story used to underline "we improved things"
 * as the phrase the interviewer caught, labelled "Vague on impact". The
 * detector flags nothing in that sentence, and the label is not one the app
 * uses, so the page described a behaviour the app does not have.
 *
 * These run the real detector, engine and report wording on the example
 * answer, so the page cannot claim anything the app would not do.
 */

import { FOLLOW_UP_EXAMPLE } from "@/components/marketing/landing-examples";
import { decideInterviewAction } from "@/lib/decision-engine";
import { SIGNAL_READINGS } from "@/lib/report-insights";
import type { AnalysisResult } from "@/lib/response-analyzer";
import { detectBehavioralSignals } from "@/lib/text-metrics";

const answer =
  FOLLOW_UP_EXAMPLE.answerBefore +
  FOLLOW_UP_EXAMPLE.marker +
  FOLLOW_UP_EXAMPLE.answerAfter;

const signals = detectBehavioralSignals(answer);

/**
 * Situation and task present, which is all the engine needs before an
 * evidence probe can take over. Every other field is the analyzer's to fill
 * and does not change the outcome.
 */
const analysis = {
  overallScore: 58,
  starAnalysis: {
    situation: { present: true, quality: 7 },
    task: { present: true, quality: 6 },
    action: { present: true, quality: 5, specificity: 5, ownership: 5 },
    result: { present: true, quality: 5, quantified: false },
  },
  languageSignals: signals,
} as unknown as AnalysisResult;

describe("the landing page's follow-up example", () => {
  it("highlights the phrase the detector flags, and nothing else", () => {
    expect(signals.signals).toHaveLength(1);
    expect(signals.signals[0].markers).toEqual([FOLLOW_UP_EXAMPLE.marker]);
  });

  it("labels it with the report's own reading", () => {
    expect(SIGNAL_READINGS[signals.signals[0].type]).toBe(
      FOLLOW_UP_EXAMPLE.reading,
    );
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    "follows up on ownership, quoting the phrase, at probing depth %i",
    (probingDepth) => {
      const decision = decideInterviewAction(analysis, {
        personaName: "Maya Kim",
        probingDepth,
      });
      expect(decision.strategy).toBe("CHALLENGE_OWNERSHIP");
      // The engine tells the interviewer to quote the word back and ask what
      // the candidate was responsible for; the example follow-up does both.
      expect(decision.reason).toContain(`"${FOLLOW_UP_EXAMPLE.marker}"`);
      expect(FOLLOW_UP_EXAMPLE.followUp).toContain(FOLLOW_UP_EXAMPLE.marker);
      expect(FOLLOW_UP_EXAMPLE.followUp).toMatch(/responsible for/);
    },
  );
});
