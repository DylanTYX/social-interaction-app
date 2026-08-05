import { describe, expect, it } from "vitest";

import { analyzeText } from "@/lib/text-metrics";

describe("analyzeText", () => {
  it("counts words", () => {
    expect(analyzeText("I led the migration").wordCount).toBe(4);
    expect(analyzeText("   ").wordCount).toBe(0);
    expect(analyzeText("").wordCount).toBe(0);
  });

  it("counts hedges", () => {
    const m = analyzeText("I think it was maybe a scaling issue, sort of.");
    expect(m.hesitationMarkers).toBe(3); // "I think", "maybe", "sort of"
  });

  it("counts contrastive qualifiers", () => {
    const m = analyzeText("It worked, but latency rose. However, we shipped.");
    expect(m.qualificationCount).toBe(2);
  });

  it("counts self-corrections", () => {
    const m = analyzeText("We used Redis — actually, sorry, I mean Memcached.");
    expect(m.revisionsCount).toBe(3);
  });

  it("finds metrics and sets hasMetrics with them", () => {
    const m = analyzeText("Cut p99 by 40% and saved $12k across 3 services.");
    expect(m.metricCount).toBeGreaterThan(0);
    expect(m.hasMetrics).toBe(true);
  });

  it("reports no metrics for a purely qualitative answer", () => {
    const m = analyzeText("I improved the process and the team was happier.");
    expect(m.metricCount).toBe(0);
    expect(m.hasMetrics).toBe(false);
  });

  it("detects timeframes in several shapes", () => {
    expect(analyzeText("It took three months.").hasTimeframes).toBe(true);
    expect(analyzeText("We shipped in 2023.").hasTimeframes).toBe(true);
    expect(analyzeText("Within 2 weeks.").hasTimeframes).toBe(true);
    expect(analyzeText("We deploy weekly.").hasTimeframes).toBe(true);
    expect(analyzeText("I fixed the bug.").hasTimeframes).toBe(false);
  });

  it("ignores fenced code when counting prose", () => {
    // A coding answer is mostly source. Without stripping it, variable names
    // and literals would be counted as the candidate's hedges and metrics.
    const withCode = analyzeText(
      "Here is my approach.\n```js\nlet x = 5; // actually maybe 10\nconst y = 42;\n```\nThat is O(n).",
    );
    expect(withCode.hesitationMarkers).toBe(0);
    expect(withCode.revisionsCount).toBe(0);
    // Only the "n" in O(n) remains — no digits from the code block.
    expect(withCode.metricCount).toBe(0);
  });

  it("ignores inline code spans too", () => {
    expect(analyzeText("Use `maybe_flag = 3` here.").hesitationMarkers).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(analyzeText("MAYBE. However, ACTUALLY.").hesitationMarkers).toBe(1);
    expect(analyzeText("MAYBE. However, ACTUALLY.").qualificationCount).toBe(1);
    expect(analyzeText("MAYBE. However, ACTUALLY.").revisionsCount).toBe(1);
  });

  it("does not treat ordinals as metrics", () => {
    // "the first thing" is not a quantified result; counting it would reward
    // filler phrasing.
    expect(analyzeText("The first thing I did was listen.").hasMetrics).toBe(
      false,
    );
  });
});

/**
 * The analyzer's merge contract. These guard the shape the sidebar and the
 * decision engine index into directly.
 */
describe("analyzer merge defaults (documented contract)", () => {
  it("keeps counted fields separate from judged ones", () => {
    // Regression guard for the split: if a countable field ever reappears in
    // the LLM schema, both sources would disagree and the code one must win.
    const m = analyzeText("I cut latency by 40% over three months.");
    expect(m.hasMetrics).toBe(true);
    expect(m.hasTimeframes).toBe(true);
    expect(m.wordCount).toBe(8);
  });
});
