import { describe, expect, it } from "vitest";

import { MAX_OFFSET, parseLimit, parseOffset } from "@/lib/api/query";

describe("parseLimit", () => {
  const parse = (value: string | null) =>
    parseLimit(new URLSearchParams(value === null ? "" : `limit=${value}`), {
      fallback: 20,
      max: 50,
    });

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

describe("parseOffset", () => {
  it("defaults to the first page", () => {
    expect(parseOffset(new URLSearchParams())).toBe(0);
  });

  it("reads a positive offset", () => {
    expect(parseOffset(new URLSearchParams("offset=50"))).toBe(50);
  });

  it("refuses a negative offset, which Postgres rejects outright", () => {
    expect(parseOffset(new URLSearchParams("offset=-10"))).toBe(0);
  });

  it("ignores junk rather than producing NaN", () => {
    // A NaN would reach `.range(NaN, NaN)` and fail the query at runtime.
    expect(parseOffset(new URLSearchParams("offset=abc"))).toBe(0);
    expect(parseOffset(new URLSearchParams("offset="))).toBe(0);
  });

  it("floors a fractional offset", () => {
    expect(parseOffset(new URLSearchParams("offset=12.9"))).toBe(12);
  });

  it("caps a runaway offset", () => {
    // This assertion used to say the opposite, on the reasoning that an offset
    // past the end simply returns no rows. True of the *result*, false of the
    // cost: Postgres still walks and discards every skipped row, so an
    // unbounded offset is a free full scan on a route with no rate limit.
    expect(parseOffset(new URLSearchParams("offset=100000000"))).toBe(
      MAX_OFFSET,
    );
  });

  it("leaves a realistic offset alone", () => {
    expect(parseOffset(new URLSearchParams("offset=100"))).toBe(100);
  });
});
