import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Route-level tests for the validation and caching contract.
 *
 * These deliberately stop at the boundary: `getCurrentUser` and `fetch` are
 * mocked, so nothing here talks to Supabase or OpenAI. What is under test is
 * the part that was wrong before — an unauthenticated caller reaching a paid
 * endpoint, an unbounded string reaching a prompt, and a cache hit still paying
 * for a model call.
 */

const getCurrentUser = vi.fn();
const getCoachAnswer = vi.fn();
const saveCoachAnswer = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/coach-answers", () => ({
  getCoachAnswer: (...args: unknown[]) => getCoachAnswer(...args),
  saveCoachAnswer: (...args: unknown[]) => saveCoachAnswer(...args),
}));

const { POST } = await import("@/app/api/coach/model-answer/route");

const SUPABASE = {} as SupabaseClient;

function request(body: unknown): Request {
  return new Request("http://localhost/api/coach/model-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function openAiReply(payload: object) {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: { content: JSON.stringify(payload) },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }),
  } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
  getCurrentUser.mockReset();
  getCoachAnswer.mockReset();
  saveCoachAnswer.mockReset();
  getCurrentUser.mockResolvedValue({
    supabase: SUPABASE,
    user: { id: "user-1" },
  });
  getCoachAnswer.mockResolvedValue(null);
  saveCoachAnswer.mockResolvedValue(undefined);
  process.env.OPENAI_API_KEY = "test-key";
});

describe("POST /api/coach/model-answer", () => {
  it("rejects an unauthenticated caller before spending anything", async () => {
    getCurrentUser.mockResolvedValue({ supabase: SUPABASE, user: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(request({ question: "Q", answer: "A" }));

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an over-length answer without calling the model", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(
      request({ question: "Q", answer: "x".repeat(10_001) }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: expect.stringContaining("answer is too long"),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a missing question", async () => {
    const response = await POST(request({ answer: "A real answer" }));
    expect(response.status).toBe(400);
  });

  it("returns the cached answer without calling the model", async () => {
    const cached = { modelAnswer: "cached", rewrite: "r", tips: ["t"] };
    getCoachAnswer.mockResolvedValue(cached);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(
      request({ question: "Q", answer: "A", sessionId: "s1", turnIndex: 2 }),
    );

    expect(await response.json()).toEqual(cached);
    // The whole point of the cache: a second look at a report is free.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not consult the cache without a session and turn index", async () => {
    // The drills page has no session, so it must not collide with a real one.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      openAiReply({ modelAnswer: "m", rewrite: "r", tips: [] }),
    );

    await POST(request({ question: "Q", answer: "A" }));

    expect(getCoachAnswer).not.toHaveBeenCalled();
    expect(saveCoachAnswer).not.toHaveBeenCalled();
  });

  it("stores a generated answer when the turn is identified", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      openAiReply({ modelAnswer: "m", rewrite: "r", tips: ["a", "b"] }),
    );

    const response = await POST(
      request({
        question: "Q",
        answer: "A",
        sessionId: "s1",
        turnIndex: 4,
        roundType: "hr",
      }),
    );

    expect(response.status).toBe(200);
    expect(saveCoachAnswer).toHaveBeenCalledWith(
      SUPABASE,
      expect.objectContaining({
        sessionId: "s1",
        turnIndex: 4,
        roundType: "hr",
      }),
    );
  });

  it("reports truncation as truncation, not as bad JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: '{"modelAnswer": "half a sen' },
            finish_reason: "length",
          },
        ],
      }),
    } as Response);

    const response = await POST(request({ question: "Q", answer: "A" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: expect.stringContaining("too long"),
    });
  });

  it("falls back to an invalid round type rather than trusting it", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        openAiReply({ modelAnswer: "m", rewrite: "r", tips: [] }),
      );

    await POST(
      request({ question: "Q", answer: "A", roundType: "../../etc/passwd" }),
    );

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    );
    const systemPrompt = body.messages[0].content as string;
    expect(systemPrompt).not.toContain("etc/passwd");
    expect(systemPrompt).toContain("STAR");
  });
});
