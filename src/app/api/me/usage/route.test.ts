import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The usage route reads the caller's own recorded model calls and prices them.
 * What is worth pinning: it refuses a signed-out caller, it never sends the
 * rate card, and the window and session filters reach the query.
 */

const getCurrentUser = vi.fn();
const listUsage = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/usage", () => ({
  listUsage: (...args: unknown[]) => listUsage(...args),
}));

const { GET } = await import("@/app/api/me/usage/route");

const SUPABASE = {} as SupabaseClient;
const request = (url: string) => new Request(`http://localhost${url}`);

beforeEach(() => {
  getCurrentUser.mockReset();
  listUsage.mockReset();
  listUsage.mockResolvedValue([
    {
      callSite: "interviewer",
      model: "gpt-5-mini",
      promptTokens: 3_000,
      completionTokens: 300,
      cachedTokens: 1_000,
    },
  ]);
  getCurrentUser.mockResolvedValue({
    supabase: SUPABASE,
    user: { id: "usage-user" },
  });
});

describe("GET /api/me/usage", () => {
  it("rejects a signed-out caller without reading anything", async () => {
    getCurrentUser.mockResolvedValue({ supabase: SUPABASE, user: null });
    const response = await GET(request("/api/me/usage"));
    expect(response.status).toBe(401);
    expect(listUsage).not.toHaveBeenCalled();
  });

  it("returns totals and a costed breakdown, never the rates", async () => {
    const response = await GET(request("/api/me/usage"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.usage.totalTokens).toBe(3_300);
    expect(body.usage.costUsd).toBeGreaterThan(0);
    expect(body.usage.purposes[0].label).toBe("Asking questions");
    // The whole point of pricing server-side: no rate card on the wire.
    expect(JSON.stringify(body)).not.toContain("cachedInput");
    expect(JSON.stringify(body)).not.toContain("MODEL_PRICING");
  });

  it("defaults to the last 30 days", async () => {
    await GET(request("/api/me/usage"));
    const [, query] = listUsage.mock.calls[0] as [unknown, { since: Date }];
    const days = (Date.now() - query.since.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("reads the whole history when asked for all time", async () => {
    const response = await GET(request("/api/me/usage?window=all"));
    const [, query] = listUsage.mock.calls[0] as [unknown, { since: unknown }];
    expect(query.since).toBeNull();
    expect((await response.json()).window).toBe("all");
  });

  it("falls back to the default window rather than failing on a bad one", async () => {
    const response = await GET(request("/api/me/usage?window=forever"));
    expect(response.status).toBe(200);
    expect((await response.json()).window).toBe("30d");
  });

  it("reads a session's whole usage, however old it is", async () => {
    const response = await GET(request("/api/me/usage?session=abc"));
    const [, query] = listUsage.mock.calls[0] as [
      unknown,
      { since: unknown; sessionId: string },
    ];
    expect(query.sessionId).toBe("abc");
    expect(query.since).toBeNull();
    expect((await response.json()).window).toBe("session");
  });
});
