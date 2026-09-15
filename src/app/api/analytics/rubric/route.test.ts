import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The analytics breakdown is a read over the caller's whole answer history, so
 * the two things worth pinning are that it refuses a signed-out caller and that
 * what it returns is the summary, not the stored analysis blobs.
 */

const getCurrentUser = vi.fn();
const listRecentAnswerScores = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/sessions")>();
  return {
    ...actual,
    listRecentAnswerScores: (...args: unknown[]) =>
      listRecentAnswerScores(...args),
  };
});

const { GET } = await import("@/app/api/analytics/rubric/route");

const SUPABASE = {} as SupabaseClient;

beforeEach(() => {
  getCurrentUser.mockReset();
  listRecentAnswerScores.mockReset();
  getCurrentUser.mockResolvedValue({
    supabase: SUPABASE,
    user: { id: "analytics-user" },
  });
});

describe("GET /api/analytics/rubric", () => {
  it("rejects a signed-out caller without reading anything", async () => {
    getCurrentUser.mockResolvedValue({ supabase: SUPABASE, user: null });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(listRecentAnswerScores).not.toHaveBeenCalled();
  });

  it("returns a summary by round type, not the raw rows", async () => {
    listRecentAnswerScores.mockResolvedValue([
      {
        roundType: "behavioral",
        star: {
          situation: { quality: 8 },
          task: { quality: 7 },
          action: { quality: 6 },
          result: { quality: 3 },
        },
        technical: null,
        specificity: { concreteExamples: 0 },
        quality: { addressesExplicitly: true },
        omitted: [],
        notes: ["No number on the outcome."],
      },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(listRecentAnswerScores).toHaveBeenCalledWith(SUPABASE);
    expect(body.answers).toBe(1);
    expect(body.rounds).toHaveLength(1);
    expect(body.rounds[0]).toMatchObject({
      roundType: "behavioral",
      answers: 1,
      notes: ["No number on the outcome."],
    });
    expect(body.rounds[0].weakest).toBeNull();
    expect(
      body.rounds[0].criteria.map((c: { label: string }) => c.label),
    ).toEqual(["Situation", "Task", "Action", "Result"]);
    expect(JSON.stringify(body)).not.toContain("starAnalysis");
  });
});
