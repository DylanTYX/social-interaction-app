import { describe, expect, it } from "vitest";

/**
 * The hero demo used to show a "Live score" that climbed, a rail of STAR
 * scores and a box to "type your answer, or hold to speak". The interview
 * screen has none of the three. It is a text interview, so the rail's third
 * measure is the answer's length in words.
 *
 * It now shows the screen's own chip and live coaching rail. These run the
 * app's formulas on the demo's readings, so every figure and sentence on it
 * is one the app would show for those answers.
 */

import {
  buildMetricChips,
  getCoachingItems,
} from "@/components/chat/live-feedback-sidebar";
import {
  MEASURES,
  NOTES_BEFORE_ANSWERS,
  SCRIPT,
  type DemoReading,
} from "@/components/marketing/animated-demo";
import { buildInterviewMetrics } from "@/lib/interview-metrics";
import { deriveMicroFeedback } from "@/lib/micro-feedback";
import type { AnalysisResult } from "@/lib/response-analyzer";
import type { InterviewSessionState } from "@/lib/interview-session-state";

const answers = SCRIPT.flatMap((turn) =>
  turn.role === "user" ? [{ text: turn.content, reading: turn.reading }] : [],
);

function toAnalysis(text: string, reading: DemoReading): AnalysisResult {
  return {
    overallScore: reading.overallScore,
    strengths: reading.strengths,
    gaps: reading.gaps,
    confidenceIndicators: {
      assertivenessScore: reading.assertivenessScore,
      hesitationMarkers: reading.hesitationMarkers,
    },
    responseQuality: {
      isRelevant: reading.isRelevant,
      length: text.trim().split(/\s+/).length,
    },
    specificityMetrics: { vaguenessScore: reading.vaguenessScore },
    starAnalysis: {
      situation: { quality: 8 },
      task: { quality: 8 },
      action: { quality: 8, specificity: reading.actionSpecificity },
      result: { quality: 8, quantified: reading.resultQuantified },
    },
  } as unknown as AnalysisResult;
}

const state = {
  sessionId: "demo",
  personaName: "Maya Kim",
  turnCount: 0,
  followupCount: 0,
  updatedAt: "",
} as unknown as InterviewSessionState;

describe("the hero demo", () => {
  it("lists the rail's notes for an interview with no answers yet", () => {
    const notes = getCoachingItems([], null).map(({ title, body, tone }) => ({
      title,
      body,
      tone,
    }));
    expect(notes).toEqual(NOTES_BEFORE_ANSWERS);
  });

  it("labels the rail as the text interview screen does", () => {
    const chips = buildMetricChips(null, [], "text");
    expect(chips.map(({ label, unit }) => ({ label, unit }))).toEqual([
      ...MEASURES,
    ]);
  });

  answers.forEach(({ text, reading }, index) => {
    describe(`after answer ${index + 1}`, () => {
      const analyses = answers
        .slice(0, index + 1)
        .map((answer) => toAnalysis(answer.text, answer.reading));
      const metrics = buildInterviewMetrics({
        analyses,
        state,
        restoredTurns: 0,
      });
      const chips = buildMetricChips(metrics, analyses, "text");

      it("shows the chip the screen derives from the reading", () => {
        expect(deriveMicroFeedback(toAnalysis(text, reading))).toEqual({
          hint: reading.hint,
          tone: reading.tone,
        });
      });

      it("shows the rail's values for the answers so far", () => {
        expect(chips.map((chip) => Math.round(chip.value ?? -1))).toEqual(
          reading.measures,
        );
      });

      it("lists the rail's notes on this answer", () => {
        const notes = getCoachingItems(analyses, null).map(
          ({ title, body, tone }) => ({ title, body, tone }),
        );
        expect(notes).toEqual(reading.notes);
      });

      it("extends each sparkline by this answer's point", () => {
        expect(chips.map((chip) => chip.trend.at(-1))).toEqual(reading.points);
      });
    });
  });

  it("follows up on words the candidate actually used", () => {
    // The second question quotes the first answer back, as the interviewer
    // is told to. The phrase must be in the answer, not paraphrased.
    const [, firstAnswer, followUp] = SCRIPT;
    const quoted = "dropped two nice-to-haves";
    expect(firstAnswer.content).toContain(quoted);
    expect(followUp.content).toContain(quoted);
  });
});
