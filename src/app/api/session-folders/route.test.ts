import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Creating folders. Ownership is the RLS policy's job; what the route owns is
 * refusing a blank name and turning a duplicate — which the case-insensitive
 * unique index reports as 23505 — into a message instead of a 500.
 */

const getCurrentUser = vi.fn();
const createSessionFolder = vi.fn();
const listSessionFolders = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/session-folders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/session-folders")>();
  return {
    ...actual,
    createSessionFolder: (...args: unknown[]) => createSessionFolder(...args),
    listSessionFolders: (...args: unknown[]) => listSessionFolders(...args),
  };
});

const { GET, POST } = await import("@/app/api/session-folders/route");

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/session-folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getCurrentUser.mockReset();
  getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "folder-user" } });
  createSessionFolder.mockReset();
  listSessionFolders.mockReset();
});

describe("/api/session-folders", () => {
  it("refuses an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue({ supabase: {}, user: null });
    expect((await GET()).status).toBe(401);
    expect((await post({ name: "Acme" })).status).toBe(401);
  });

  it("refuses a blank name without touching the database", async () => {
    expect((await post({ name: "   " })).status).toBe(400);
    expect(createSessionFolder).not.toHaveBeenCalled();
  });

  it("explains a duplicate name instead of failing with a 500", async () => {
    createSessionFolder.mockRejectedValue(Object.assign(new Error("dup"), { code: "23505" }));
    const response = await post({ name: "Acme" });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("already have a folder called");
  });

  it("creates a folder with the trimmed name", async () => {
    createSessionFolder.mockResolvedValue({ id: "f1", name: "Acme", sessionCount: 0 });
    const response = await post({ name: "  Acme  " });
    expect(response.status).toBe(200);
    expect(createSessionFolder).toHaveBeenCalledWith({}, "folder-user", "Acme");
  });
});
