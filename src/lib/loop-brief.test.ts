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
    family: "behavioural" as const,
    askedQuestions: [],
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

  const technical = {
    ...round,
    title: "Technical 1",
    roundTypeLabel: "Technical SWE",
    family: "technical" as const,
    askedQuestions: [
      "Design a rate limiter for an API gateway?",
      "How would you handle the distributed case?",
      "What is the time complexity of that?",
    ],
  };

  it("lists what a round already asked", () => {
    const brief = buildLoopBrief([technical], "technical") ?? "";

    expect(brief).toContain("Already asked:");
    expect(brief).toContain('"Design a rate limiter for an API gateway?"');
    expect(brief).toContain("do not ask it again");
  });

  it("carries at most four questions, keeping the most recent", () => {
    const many = {
      ...technical,
      askedQuestions: Array.from({ length: 9 }, (_, i) => `Question ${i}?`),
    };

    const brief = buildLoopBrief([many], "technical") ?? "";

    expect(brief).toContain('"Question 8?"');
    expect(brief).not.toContain('"Question 0?"');
    // Exactly four, not "at least four".
    expect(brief.match(/"Question \d\?"/g)).toHaveLength(4);
  });

  it("drops the questions when the next round is a different family", () => {
    // A technical round's problems tell an HR interviewer nothing it can act
    // on, and this sits in a prompt layer re-sent on every turn.
    const brief = buildLoopBrief([technical], "behavioural") ?? "";

    expect(brief).toContain("Technical 1");
    expect(brief).toContain("clear motivation");
    expect(brief).not.toContain("Already asked:");
    expect(brief).not.toContain("do not ask it again");
  });

  it("omits the do-not-repeat line when no round carried questions", () => {
    const brief = buildLoopBrief([round], "behavioural") ?? "";

    expect(brief).not.toContain("Already asked");
    expect(brief).not.toContain("do not ask it again");
  });

  it("emits the header exactly once for a three-round loop", () => {
    // The regression this rewrite exists for. The route used to call this with
    // a one-element array and string-join the result onto the inherited brief,
    // so round 4 carried the three-line preamble three times over — duplicated
    // instruction inside the cacheable prefix.
    const brief =
      buildLoopBrief(
        [round, technical, { ...technical, title: "System design" }],
        "technical",
      ) ?? "";

    expect(
      brief.match(/Notes from this candidate's earlier rounds/g),
    ).toHaveLength(1);
    expect(brief).toContain("Recruiter screen");
    expect(brief).toContain("Technical 1");
    expect(brief).toContain("System design");
  });

  it("carries every round's questions when no family is given", () => {
    // No target family means "do not filter" — the shape the report path and
    // any future caller without an upcoming round gets.
    const brief = buildLoopBrief([technical]) ?? "";
    expect(brief).toContain("Already asked:");
  });
});
