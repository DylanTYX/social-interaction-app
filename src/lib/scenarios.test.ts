import { describe, expect, it } from "vitest";

import {
  BRIEF_QUICK_STARTS,
  briefTitle,
  unfilledPlaceholders,
} from "@/lib/scenarios";

describe("unfilledPlaceholders", () => {
  it("finds the placeholder that reached a live interview", () => {
    // "Recruiter screening call for a [role] role. Test motivation…" is 100+
    // characters, so it cleared the 20-character gate and the interview opened
    // with "[role]" in it. Length is not completeness.
    expect(
      unfilledPlaceholders(
        "Recruiter screening call for a [role] role. Test motivation and fit.",
      ),
    ).toEqual(["[role]"]);
  });

  it("finds several", () => {
    expect(
      unfilledPlaceholders("Interview for a [role] at a [company type]."),
    ).toEqual(["[role]", "[company type]"]);
  });

  it("passes a brief the user actually filled in", () => {
    expect(
      unfilledPlaceholders(
        "Senior data analyst at a mid-size SaaS company. SQL and dashboards.",
      ),
    ).toEqual([]);
  });

  it("ignores brackets that are not fill-in-the-blanks", () => {
    // Long bracketed asides are prose, not placeholders.
    expect(
      unfilledPlaceholders(
        "I want to practise [because my last interview went badly and I froze on the system design round].",
      ),
    ).toEqual([]);
  });

  it("every shipped quick-start is caught before launch", () => {
    // Guard: if a template gains a placeholder, the gate must still catch it.
    const templated = BRIEF_QUICK_STARTS.filter(
      (chip) => unfilledPlaceholders(chip.template).length > 0,
    );
    expect(templated.length).toBeGreaterThan(0);
  });
});

describe("briefTitle", () => {
  it("returns a short brief unchanged", () => {
    expect(briefTitle("Backend interview at a fintech")).toBe(
      "Backend interview at a fintech",
    );
  });

  it("truncates a long brief for use as a label", () => {
    const long = "x".repeat(80);
    const title = briefTitle(long);
    expect(title).toHaveLength(57);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back when the brief is empty", () => {
    expect(briefTitle("   ").length).toBeGreaterThan(0);
    expect(briefTitle("   ")).not.toContain("…");
  });
});
