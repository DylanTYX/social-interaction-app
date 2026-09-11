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
const updateSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/sessions")>();
  return {
    ...actual,
    deleteSession: (...args: unknown[]) => deleteSession(...args),
    updateSession: (...args: unknown[]) => updateSession(...args),
  };
});

const { DELETE, PATCH } = await import("@/app/api/sessions/[id]/route");

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
  updateSession.mockReset();
  updateSession.mockResolvedValue({ id: SESSION_ID });
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

describe("PATCH /api/sessions/[id] — organising a session", () => {
  /**
   * Rename, tags, pin, notes and archive arrived together (0018). The
   * risk in adding them was to the fields already there: a rename is a PATCH
   * that mentions nothing else, and the route used to turn a missing summary
   * into null — which clears it.
   */
  const patch = (body: unknown) =>
    PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      ctx(SESSION_ID),
    );
  const sent = (call = 0) => updateSession.mock.calls[call][2];

  beforeEach(() => {
    getCurrentUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });
  });

  it("renames, and a blank title resets to the generated one", async () => {
    await patch({ title: "  Acme final round  " });
    expect(sent(0).title).toBe("Acme final round");

    await patch({ title: "   " });
    expect(sent(1).title).toBeNull();
  });

  it("leaves every other field alone when only the title is sent", async () => {
    await patch({ title: "Acme" });
    const input = sent();
    expect(input.summary).toBeUndefined();
    expect(input.tags).toBeUndefined();
    expect(input.archivedAt).toBeUndefined();
  });

  it("normalises tags and refuses more than the limit", async () => {
    await patch({ tags: ["Acme", "acme", " #round 2 "] });
    expect(sent().tags).toEqual(["Acme", "round 2"]);

    const tooMany = await patch({ tags: Array.from({ length: 13 }, (_, i) => `t${i}`) });
    expect(tooMany.status).toBe(400);
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("stamps the archive time on the server and clears it to unarchive", async () => {
    await patch({ archived: true });
    expect(Date.parse(sent(0).archivedAt)).not.toBeNaN();

    await patch({ archived: false });
    expect(sent(1).archivedAt).toBeNull();
  });

});
