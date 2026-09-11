import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Every unexpected failure reached the user as "Something went wrong. Please
 * try again." — so a failing voice opening on a deployment could not be told
 * apart from any other failure, and the log line behind it could not be found.
 * The generic message stays; these pin what now travels with it, and what
 * never does.
 */

import { ClientVisibleError, handleRouteError } from "@/lib/api/errors";

afterEach(() => vi.restoreAllMocks());

async function respond(error: unknown) {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = handleRouteError("test", error);
  return { status: response.status, body: await response.json() };
}

describe("an unexpected server error", () => {
  it("keeps the generic message and adds a reference that is also logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = handleRouteError("POST /api/chat", new Error("boom"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe("Something went wrong. Please try again.");
    expect(body.ref).toMatch(/^[a-z0-9-]{6,}$/);
    expect(String(log.mock.calls[0][0])).toContain(`ref=${body.ref}`);
  });

  it("carries a database error class, and nothing else from the error", async () => {
    const { body } = await respond(
      Object.assign(new Error('permission denied for table "interview_messages"'), {
        code: "42501",
        details: "secret detail",
      }),
    );
    expect(body.code).toBe("42501");
    expect(JSON.stringify(body)).not.toMatch(/interview_messages|secret detail|permission denied/);
  });

  it("recognises a PostgREST code", async () => {
    const { body } = await respond(Object.assign(new Error("x"), { code: "PGRST202" }));
    expect(body.code).toBe("PGRST202");
  });

  it("ignores a code that is not a plain error class", async () => {
    const { body } = await respond(Object.assign(new Error("x"), { code: "ECONNRESET: at 10.0.0.1" }));
    expect(body.code).toBeUndefined();
  });
});

describe("a client-visible error", () => {
  it("is returned as authored, with no reference attached", async () => {
    const { status, body } = await respond(new ClientVisibleError("Resume is too short.", 400));
    expect(status).toBe(400);
    expect(body).toEqual({ error: "Resume is too short." });
  });
});
