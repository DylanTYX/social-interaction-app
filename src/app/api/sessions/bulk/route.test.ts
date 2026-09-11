import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bulk session actions. The route adds no permission of its own — every write
 * goes through the same single-session paths — so these pin the parts that
 * are its own: validation, the per-session tag merge, and counting failures
 * instead of failing the batch.
 */

const getCurrentUser = vi.fn();
const patchSession = vi.fn();
const deleteSession = vi.fn();
const getSessionTags = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/sessions", () => ({
  patchSession: (...args: unknown[]) => patchSession(...args),
  deleteSession: (...args: unknown[]) => deleteSession(...args),
  getSessionTags: (...args: unknown[]) => getSessionTags(...args),
}));

const { POST } = await import("@/app/api/sessions/bulk/route");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/sessions/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getCurrentUser.mockReset();
  getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "bulk-user" } });
  patchSession.mockReset();
  patchSession.mockResolvedValue(undefined);
  deleteSession.mockReset();
  deleteSession.mockResolvedValue(undefined);
  getSessionTags.mockReset();
});

describe("POST /api/sessions/bulk", () => {
  it("refuses an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue({ supabase: {}, user: null });
    expect((await post({ ids: [A], action: "archive" })).status).toBe(401);
    expect(patchSession).not.toHaveBeenCalled();
  });

  it("rejects an unknown action and an empty or oversized selection", async () => {
    expect((await post({ ids: [A], action: "explode" })).status).toBe(400);
    expect((await post({ ids: [], action: "archive" })).status).toBe(400);
    const tooMany = Array.from({ length: 101 }, () => A);
    expect((await post({ ids: tooMany, action: "archive" })).status).toBe(400);
    expect(patchSession).not.toHaveBeenCalled();
  });

  it("archives each selected session once, even if an id repeats", async () => {
    const response = await post({ ids: [A, B, A], action: "archive" });
    expect(await response.json()).toEqual({ updated: 2, failed: 0 });
    expect(patchSession).toHaveBeenCalledTimes(2);
    expect(Date.parse(patchSession.mock.calls[0][2].archivedAt)).not.toBeNaN();
  });

  it("adds a tag per session, skipping ones that already have it in any case", async () => {
    getSessionTags.mockResolvedValue(new Map([[A, ["Acme"]], [B, []]]));
    const response = await post({ ids: [A, B], action: "add_tag", tag: "acme" });

    expect(await response.json()).toEqual({ updated: 2, failed: 0 });
    // A already had it: no write. B gets it.
    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(patchSession).toHaveBeenCalledWith({}, B, { tags: ["acme"] });
  });

  it("counts a session it cannot read as failed rather than failing the batch", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getSessionTags.mockResolvedValue(new Map([[A, []]]));
    const response = await post({ ids: [A, C], action: "add_tag", tag: "Round 2" });
    expect(await response.json()).toEqual({ updated: 1, failed: 1 });
  });

  it("needs a folder to move to, and accepts null to unfile", async () => {
    expect((await post({ ids: [A], action: "move" })).status).toBe(400);
    const response = await post({ ids: [A], action: "move", folderId: null });
    expect(response.status).toBe(200);
    expect(patchSession).toHaveBeenCalledWith({}, A, { folderId: null });
  });

  it("deletes through the single-session delete", async () => {
    await post({ ids: [A, B], action: "delete" });
    expect(deleteSession).toHaveBeenCalledTimes(2);
  });
});
