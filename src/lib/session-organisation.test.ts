import { describe, expect, it } from "vitest";

/**
 * A session could only be opened or deleted. These pin the rules for naming,
 * tagging, sorting and filtering, which the tag editor and the API share — if
 * the two normalised a tag differently, "Acme" typed on the page and "acme"
 * stored by the server would read as two tags.
 */

import {
  addTag,
  displayTitle,
  normalizeTag,
  normalizeTags,
  parseArchivedView,
  parseScoreBand,
  parseSessionSort,
  parseSinceWindow,
  removeTag,
  scoreBandRange,
  sinceToIso,
} from "@/lib/session-organisation";

describe("tags", () => {
  it.each([
    ["  Acme  ", "Acme"],
    ["#system design", "system design"],
    ["  #round 2 ", "round 2"],
    ["final   round", "final round"],
    ["", null],
    ["   ", null],
    [42, null],
  ])("normalises %j to %j", (input, expected) => {
    expect(normalizeTag(input)).toBe(expected);
  });

  it("caps a tag rather than rejecting it", () => {
    expect(normalizeTag("x".repeat(80))).toHaveLength(32);
  });

  it("removes duplicates regardless of case, keeping the first spelling", () => {
    expect(normalizeTags(["Acme", "acme", " ACME ", "Round 2"])).toEqual(["Acme", "Round 2"]);
  });

  it("adds and removes without regard to case", () => {
    expect(addTag(["Acme"], "acme")).toEqual(["Acme"]);
    expect(addTag(["Acme"], "Round 2")).toEqual(["Acme", "Round 2"]);
    expect(removeTag(["Acme", "Round 2"], "acme")).toEqual(["Round 2"]);
  });
});

describe("display title", () => {
  it("prefers the candidate's own name for the session", () => {
    expect(displayTitle({ title: "Acme final", scenarioTitle: "Your interview brief", scenarioValue: "custom" })).toBe("Acme final");
  });

  it("falls back to the generated title, then the scenario value", () => {
    expect(displayTitle({ title: "  ", scenarioTitle: "Round 1/2: Screening", scenarioValue: "custom" })).toBe("Round 1/2: Screening");
    expect(displayTitle({ title: null, scenarioTitle: null, scenarioValue: "qbr" })).toBe("qbr");
  });
});

describe("sort and filter parameters", () => {
  it("accepts only known sorts", () => {
    expect(parseSessionSort("score_high")).toBe("score_high");
    expect(parseSessionSort("drop table")).toBeUndefined();
  });

  it("maps score bands to inclusive integer ranges", () => {
    expect(scoreBandRange(parseScoreBand("strong"))).toEqual({ min: 80, max: undefined });
    expect(scoreBandRange(parseScoreBand("fair"))).toEqual({ min: 60, max: 79 });
    expect(scoreBandRange(parseScoreBand("weak"))).toEqual({ min: undefined, max: 59 });
    expect(scoreBandRange(parseScoreBand("nonsense"))).toEqual({ min: undefined, max: undefined });
  });

  it("turns a date window into a cut-off", () => {
    const now = Date.parse("2026-09-12T00:00:00Z");
    expect(sinceToIso(parseSinceWindow("7d"), now)).toBe("2026-09-05T00:00:00.000Z");
    expect(sinceToIso(parseSinceWindow("any"), now)).toBeUndefined();
  });

  it("has no archive filter unless one is asked for", () => {
    // The dashboard and analytics read the same list and must keep counting
    // archived sessions.
    expect(parseArchivedView(null)).toBeUndefined();
    expect(parseArchivedView("active")).toBe("active");
  });
});
