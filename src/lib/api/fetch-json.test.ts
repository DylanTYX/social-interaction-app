import { describe, expect, it } from "vitest";

import { parseLimit, readJson } from "@/lib/api/fetch-json";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("readJson", () => {
  it("returns the parsed body on success", async () => {
    await expect(readJson<{ ok: boolean }>(jsonResponse({ ok: true }))).resolves.toEqual({
      ok: true,
    });
  });

  it("throws the server's own error message", async () => {
    // The point of this helper: callers get "Resume must contain at least 80
    // characters", not "HTTP 400".
    await expect(
      readJson(jsonResponse({ error: "Resume is too short." }, 400)),
    ).rejects.toThrow("Resume is too short.");
  });

  it("falls back to the status when the error body is not JSON", async () => {
    // A proxy 502 or an auth redirect returns HTML; parsing it would mask the
    // real status.
    await expect(
      readJson(new Response("<html>Bad Gateway</html>", { status: 502 })),
    ).rejects.toThrow("HTTP 502");
  });
});

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
