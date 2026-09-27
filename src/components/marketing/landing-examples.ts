import type { AnalysisResult } from "@/lib/response-analyzer";

/**
 * One example behavioural round, as the analyzer might have scored it.
 *
 * The landing page's report mocks are drawn from these through the report's
 * own functions — the dimension profile, the tiles and their captions, the
 * note under an answer — so every figure and sentence in them is what the
 * report would show for a round scored this way. The readings are the example;
 * nothing downstream of them is typed by hand.
 */
export const EXAMPLE_ROUND = [
  {
    overallScore: 78,
    star: [8, 8, 8, 7],
    vagueness: 3,
    clarity: 8,
    assertiveness: 7.5,
    hesitations: 1,
    gaps: [],
  },
  {
    overallScore: 80,
    star: [8, 7, 8, 6],
    vagueness: 3,
    clarity: 8,
    assertiveness: 7.5,
    hesitations: 2,
    gaps: [],
  },
  {
    overallScore: 64,
    star: [8, 7, 4, 3],
    vagueness: 5,
    clarity: 6,
    assertiveness: 6.5,
    hesitations: 3,
    gaps: [
      "The action is the team's, not yours.",
      "The result has no number attached.",
    ],
  },
  {
    overallScore: 74,
    star: [8, 8, 7, 5],
    vagueness: 4,
    clarity: 7,
    assertiveness: 7,
    hesitations: 2,
    gaps: [],
  },
] as const;

/** The answer the page shows the note for: the weakest, as a real report would flag. */
export const EXAMPLE_NOTED_ANSWER = 2;

export const EXAMPLE_ANALYSES: AnalysisResult[] = EXAMPLE_ROUND.map(
  (answer) =>
    ({
      overallScore: answer.overallScore,
      strengths: [],
      gaps: [...answer.gaps],
      starAnalysis: {
        situation: { present: true, quality: answer.star[0] },
        task: { present: true, quality: answer.star[1] },
        action: { present: true, quality: answer.star[2] },
        result: { present: true, quality: answer.star[3] },
      },
      specificityMetrics: { vaguenessScore: answer.vagueness },
      confidenceIndicators: {
        assertivenessScore: answer.assertiveness,
        clarity: answer.clarity,
        hesitationMarkers: answer.hesitations,
      },
      responseQuality: { isRelevant: true, length: 90 },
    }) as unknown as AnalysisResult,
);

/** The rest of the example report: the minutes it took, the guess, last time. */
export const EXAMPLE_REPORT = {
  durationMinutes: 22,
  predicted: 70,
  previousScore: 68,
  /** A default interviewer, in the middle for difficulty. */
  strictness: 5,
  warmth: 5,
  rewrite:
    "The roadmap changed mid-quarter. I re-scoped to the two changes with the highest reach, and we still launched on the 14th with a 12% lift.",
} as const;
