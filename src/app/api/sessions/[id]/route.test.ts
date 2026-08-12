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

/**
 * Real uuids, because the route now validates the shape before it reaches the
 * database. Postgres raises `22P02` on a malformed id, which surfaced as a 500
 * with a stack where 404 is the honest answer.
 */
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const MISSING_ID = "22222222-2222-4222-8222-222222222222";

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

    return DELETE(new Request("http://localhost"), ctx(SESSION_ID)).then(
      async (response) => {
        expect(response.status).toBe(401);
        expect(deleteSession).not.toHaveBeenCalled();
      },
    );
  });

  it("passes the id from the route through to the delete", async () => {
    getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });

    const response = await DELETE(
      new Request("http://localhost"),
      ctx(SESSION_ID),
    );

    expect(response.status).toBe(200);
    expect(deleteSession).toHaveBeenCalledWith({}, SESSION_ID);
  });

  it("reports ok for an id that does not exist", async () => {
    // Matching the personas, job-description and resume deletes: no existence
    // check, so a double-click or a stale row cannot produce a spurious error.
    getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });

    const response = await DELETE(
      new Request("http://localhost"),
      ctx(MISSING_ID),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("404s a malformed id instead of letting Postgres raise", async () => {
    // `.eq("id", "not-a-uuid")` raises 22P02, which reached the client as a 500
    // with a full stack in the logs. A wrong URL is a 404, and real 500s should
    // be findable.
    getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });

    const response = await DELETE(new Request("http://localhost"), ctx("nope"));

    expect(response.status).toBe(404);
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("surfaces a database failure as a 500 rather than a silent success", async () => {
    getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });
    deleteSession.mockRejectedValue(new Error("connection lost"));

    const response = await DELETE(
      new Request("http://localhost"),
      ctx(SESSION_ID),
    );

    expect(response.status).toBe(500);
  });
});
