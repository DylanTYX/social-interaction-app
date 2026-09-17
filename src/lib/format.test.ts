import { describe, expect, it } from "vitest";

import {
  formatDateTime,
  formatRelativeDate,
  formatTokens,
  formatUsd,
  initialsFromName,
} from "@/lib/format";

describe("formatRelativeDate", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it("returns an empty string for an unparseable value", () => {
    expect(formatRelativeDate("not a date")).toBe("");
    expect(formatRelativeDate("")).toBe("");
  });

  it("walks the ladder", () => {
    expect(formatRelativeDate(ago(10_000))).toBe("Just now");
    expect(formatRelativeDate(ago(5 * MIN))).toBe("5 min ago");
    expect(formatRelativeDate(ago(HOUR))).toBe("1 hour ago");
    expect(formatRelativeDate(ago(5 * HOUR))).toBe("5 hours ago");
    expect(formatRelativeDate(ago(DAY))).toBe("Yesterday");
    expect(formatRelativeDate(ago(3 * DAY))).toBe("3 days ago");
  });

  it("keeps the weeks branch that one copy had lost", () => {
    // The dashboard's copy said "3 weeks ago" where the sessions page's copy
    // fell through to a bare locale date, for the same timestamp.
    expect(formatRelativeDate(ago(7 * DAY))).toBe("1 week ago");
    expect(formatRelativeDate(ago(21 * DAY))).toBe("3 weeks ago");
  });

  it("falls back to a date once weeks stop reading well", () => {
    const old = formatRelativeDate(ago(120 * DAY));
    expect(old).not.toContain("ago");
    expect(old.length).toBeGreaterThan(0);
  });
});

describe("formatDateTime", () => {
  it("returns an empty string for an unparseable value", () => {
    expect(formatDateTime("nope")).toBe("");
  });

  it("renders a parseable timestamp", () => {
    expect(formatDateTime("2026-01-15T10:30:00.000Z").length).toBeGreaterThan(
      0,
    );
  });
});

describe("initialsFromName", () => {
  it("takes first and last initials", () => {
    expect(initialsFromName("Ada Lovelace")).toBe("AL");
    expect(initialsFromName("Ada Byron King Lovelace")).toBe("AL");
  });

  it("takes two characters from a single name", () => {
    expect(initialsFromName("Ada")).toBe("AD");
  });

  it("handles empty and whitespace input", () => {
    expect(initialsFromName("")).toBe("??");
    expect(initialsFromName("   ")).toBe("??");
  });
});

describe("formatTokens", () => {
  it("keeps a small count exact", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(840)).toBe("840");
  });

  it("rounds a big count to the precision it deserves", () => {
    expect(formatTokens(3_412)).toBe("3,400");
    expect(formatTokens(23_847)).toBe("24,000");
  });
});

describe("formatUsd", () => {
  it("does not print real spend as zero", () => {
    // Two decimal places would round a turn's cost to "$0.00".
    expect(formatUsd(0.0042)).toBe("$0.004");
    expect(formatUsd(0.0001)).toBe("under $0.001");
  });

  it("uses the usual two places from a dollar up", () => {
    expect(formatUsd(1.2345)).toBe("$1.23");
  });

  it("treats nothing as nothing", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });
});
