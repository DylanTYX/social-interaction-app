import { describe, expect, it } from "vitest";

import { buildLoopBrief, collectTopThemes } from "@/lib/loop-brief";

const analysis = (strengths: string[], gaps: string[]) =>
  ({ strengths, gaps }) as never;

describe("collectTopThemes", () => {
  it("ranks by how often a theme recurs", () => {
    const themes = collectTopThemes(
      [
        analysis(["clear ownership", "good structure"], []),
        analysis(["clear ownership"], []),
        analysis(["quantified impact"], []),
      ],
      "strengths",
    );
    expect(themes[0]).toBe("clear ownership");
  });

  it("ignores blanks and non-strings", () => {
    const themes = collectTopThemes(
      [analysis(["  ", "real theme"], []), analysis([], [])],
      "strengths",
    );
    expect(themes).toEqual(["real theme"]);
  });
});

describe("buildLoopBrief", () => {
  const round = {
    title: "Recruiter screen",
    roundTypeLabel: "Intro / screening",
    averageScore: 72,
    analyses: [analysis(["clear motivation"], ["vague on impact"])],
  };

  it("returns null when no round was scored", () => {
    // A loop whose first round was abandoned has nothing to hand over.
    expect(buildLoopBrief([])).toBeNull();
    expect(buildLoopBrief([{ ...round, analyses: [] }])).toBeNull();
  });

  it("summarises a completed round", () => {
    const brief = buildLoopBrief([round]) ?? "";
    expect(brief).toContain("Recruiter screen");
    expect(brief).toContain("clear motivation");
    expect(brief).toContain("vague on impact");
    expect(brief).toContain("72/100");
  });

  it("tells the interviewer not to read it aloud", () => {
    // It goes in the prompt; without this the model recites it.
    expect(buildLoopBrief([round])).toContain("never read them out");
  });

  it("omits the score when the round was not scored", () => {
    const brief = buildLoopBrief([{ ...round, averageScore: null }]) ?? "";
    expect(brief).not.toContain("/100");
    expect(brief).toContain("Recruiter screen");
  });
});
