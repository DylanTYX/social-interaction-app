import { describe, expect, it } from "vitest";

import { buildRadarAxes } from "@/components/report/dimension-radar";
import type { AnalysisResult } from "@/lib/response-analyzer";

/**
 * Inline partials rather than `makeAnalysis`: the lint boundary keeps
 * `@/lib/test-support` out of `src/components`, and the builder is written
 * for stored-jsonb partials anyway — feeding it full fixtures would test a
 * shape it never relies on.
 */
function star(quality: {
  situation?: number;
  task?: number;
  action?: number;
  result?: number;
}): Partial<AnalysisResult> {
  return {
    starAnalysis: {
      situation: {
        present: true,
        quality: quality.situation ?? 8,
        context: "",
      },
      task: { present: true, quality: quality.task ?? 8, clarity: "" },
      action: {
        present: true,
        quality: quality.action ?? 8,
        specificity: 8,
        ownership: 8,
        summary: "",
      },
      result: {
        present: true,
        quality: quality.result ?? 8,
        quantified: true,
        impact: "",
      },
    },
  };
}

describe("buildRadarAxes", () => {
  it("averages behavioural axes across turns and inverts vagueness", () => {
    const axes = buildRadarAxes(
      [
        {
          ...star({}),
          specificityMetrics: { vaguenessScore: 2 } as never,
          confidenceIndicators: { clarity: 7 } as never,
        },
        {
          ...star({ situation: 4 }),
          specificityMetrics: { vaguenessScore: 2 } as never,
          confidenceIndicators: { clarity: 7 } as never,
        },
      ],
      false,
    );
    expect(axes).not.toBeNull();
    const byLabel = Object.fromEntries(axes!.map((a) => [a.label, a.value]));
    expect(byLabel.Situation).toBe(6); // (8 + 4) / 2
    // vaguenessScore 2 → specificity 8: inverted so outward = better.
    expect(byLabel.Specificity).toBe(8);
    expect(byLabel.Clarity).toBe(7);
  });

  it("uses the technical rubric's seven axes for technical rounds", () => {
    const axes = buildRadarAxes(
      [
        {
          technicalScores: {
            problemFraming: 7,
            approach: 6,
            correctness: 8,
            complexity: 5,
            communication: 7,
            edgeCases: 4,
            codeQuality: 6,
          },
        },
      ],
      true,
    );
    expect(axes!.map((a) => a.label)).toEqual([
      "Framing",
      "Approach",
      "Correctness",
      "Complexity",
      "Communication",
      "Edge cases",
      "Code quality",
    ]);
  });

  it("returns null when nothing contributed, and skips absent blocks", () => {
    // A technical radar over analyses with no technicalScores block: old rows,
    // or the analyzer omitted it. Render nothing, not an empty web.
    expect(buildRadarAxes([{}], true)).toBeNull();
    expect(buildRadarAxes([], false)).toBeNull();
  });

  it("drops an axis with no data rather than plotting it at zero", () => {
    const partial = buildRadarAxes([star({})], false);
    // specificityMetrics/confidenceIndicators absent → those axes are gone,
    // not zeroed — a zero would read as "answered terribly".
    expect(partial!.map((a) => a.label)).toEqual([
      "Situation",
      "Task",
      "Action",
      "Result",
    ]);
  });
});
