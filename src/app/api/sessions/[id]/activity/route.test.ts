import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The endpoint the session page reports its on-screen time to.
 *
 * Duration is derived from what this records, so the checks that matter are
 * the ones that keep a bad report out: no caller, a malformed id, or a body
 * that is not a sensible number of seconds. The database function adds the
 * rest (ownership, the per-call cap, ignoring finished sessions).
 */

const getCurrentUser = vi.fn();
const recordSessionActivity = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/sessions")>();
  return {
    ...actual,
    recordSessionActivity: (...args: unknown[]) => recordSessionActivity(...args),
  };
});

const { POST } = await import("@/app/api/sessions/[id]/activity/route");

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

const post = (body: unknown, id = SESSION_ID) =>
  POST(
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  getCurrentUser.mockReset();
  getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });
  recordSessionActivity.mockReset();
  recordSessionActivity.mockResolvedValue(90);
});

describe("POST /api/sessions/[id]/activity", () => {
  it("refuses an unauthenticated caller and records nothing", async () => {
    getCurrentUser.mockResolvedValue({ supabase: {}, user: null });
    const response = await post({ seconds: 30 });
    expect(response.status).toBe(401);
    expect(recordSessionActivity).not.toHaveBeenCalled();
  });

  it("adds the seconds to the session and returns the new total", async () => {
    const response = await post({ seconds: 30 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ activeSeconds: 90 });
    expect(recordSessionActivity).toHaveBeenCalledWith({}, SESSION_ID, 30);
  });

  it.each([0, -5, 121, 12.5, "30", null])(
    "rejects %j seconds without touching the database",
    async (seconds) => {
      const response = await post({ seconds });
      expect(response.status).toBe(400);
      expect(recordSessionActivity).not.toHaveBeenCalled();
    },
  );

  it("404s a malformed session id", async () => {
    const response = await post({ seconds: 30 }, "nope");
    expect(response.status).toBe(404);
    expect(recordSessionActivity).not.toHaveBeenCalled();
  });
});
