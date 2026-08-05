import { describe, expect, it } from "vitest";

import { parseLimit } from "@/lib/api/query";

describe("parseLimit", () => {
  const parse = (value: string | null) =>
    parseLimit(
      new URLSearchParams(value === null ? "" : `limit=${value}`),
      { fallback: 20, max: 50 },
    );

  it("uses the fallback when absent or unusable", () => {
    expect(parse(null)).toBe(20);
    expect(parse("")).toBe(20);
    expect(parse("abc")).toBe(20);
    expect(parse("0")).toBe(20);
    expect(parse("-5")).toBe(20);
  });

  it("caps at the maximum", () => {
    // The cap is the only thing stopping a client asking for the whole table.
    expect(parse("10000")).toBe(50);
    expect(parse("50")).toBe(50);
  });

  it("passes through a sensible value, flooring fractions", () => {
    expect(parse("30")).toBe(30);
    expect(parse("30.9")).toBe(30);
  });
});
