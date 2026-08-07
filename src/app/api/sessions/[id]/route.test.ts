import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The session DELETE endpoint.
 *
 * Worth testing at the HTTP layer rather than only the db helper, because the
 * two things that can go wrong here are both route-level: deleting without
 * authenticating, and passing the wrong id through.
 *
 * Ownership itself is enforced by the `sessions_owner_all` RLS policy inside
 * Postgres, not by this route — so there is deliberately no ownership assertion
 * to test here. A foreign id reaches the database and deletes nothing.
 */

const getCurrentUser = vi.fn();
const deleteSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/sessions")>();
  return {
    ...actual,
    deleteSession: (...args: unknown[]) => deleteSession(...args),
  };
});

const { DELETE } = await import("@/app/api/sessions/[id]/route");

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getCurrentUser.mockReset();
  deleteSession.mockReset();
  deleteSession.mockResolvedValue(undefined);
});

describe("DELETE /api/sessions/[id]", () => {
  it("refuses an unauthenticated caller and touches nothing", () => {
    getCurrentUser.mockResolvedValue({ supabase: {}, user: null });

    return DELETE(new Request("http://localhost"), ctx("abc")).then(
      async (response) => {
        expect(response.status).toBe(401);
        expect(deleteSession).not.toHaveBeenCalled();
      },
    );
  });

  it("passes the id from the route through to the delete", async () => {
    getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });

    const response = await DELETE(new Request("http://localhost"), ctx("s-42"));

    expect(response.status).toBe(200);
    expect(deleteSession).toHaveBeenCalledWith({}, "s-42");
  });

  it("reports ok for an id that does not exist", async () => {
    // Matching the personas, job-description and resume deletes: no existence
    // check, so a double-click or a stale row cannot produce a spurious error.
    getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });

    const response = await DELETE(new Request("http://localhost"), ctx("gone"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("surfaces a database failure as a 500 rather than a silent success", async () => {
    getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });
    deleteSession.mockRejectedValue(new Error("connection lost"));

    const response = await DELETE(new Request("http://localhost"), ctx("s-1"));

    expect(response.status).toBe(500);
  });
});
