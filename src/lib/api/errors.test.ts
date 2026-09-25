import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Every unexpected failure reached the user as "Something went wrong. Please
 * try again." — so a failing voice opening on a deployment could not be told
 * apart from any other failure, and the log line behind it could not be found.
 * The generic message stays; these pin what now travels with it, and what
 * never does.
 */

import { ClientVisibleError, handleRouteError } from "@/lib/api/errors";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

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

describe("a database older than the code", () => {
  it.each(["42703", "42P01", "PGRST204", "PGRST205"])(
    "says to apply migrations for %s, beside the generic message",
    async (code) => {
      const { status, body } = await respond(Object.assign(new Error("x"), { code }));
      expect(status).toBe(500);
      expect(body.error).toBe("Something went wrong. Please try again.");
      expect(body.hint).toMatch(/database is behind .* migrations/i);
      expect(body.code).toBe(code);
    },
  );
});

describe("in production", () => {
  it("sends the message and the reference, and nothing about the system", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = handleRouteError(
      "test",
      Object.assign(new Error('column "tags" does not exist'), { code: "42703" }),
    );
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["error", "ref"]);
    expect(body.error).toBe("Something went wrong. Please try again.");
    // The person running the deployment still finds it, under the reference.
    expect(String(log.mock.calls[0][0])).toMatch(
      new RegExp(`ref=${body.ref} code=42703 hint=".*migrations`),
    );
  });

  it("keeps an operator hint in the log and out of the response", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = handleRouteError(
      "test",
      new ClientVisibleError("The interviewer is unavailable right now.", 503, "Set SOME_KEY."),
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "The interviewer is unavailable right now.", ref: body.ref });
    expect(String(log.mock.calls[0][0])).toContain(`ref=${body.ref} hint="Set SOME_KEY."`);
  });
});

describe("a client-visible error", () => {
  it("is returned as authored, with no reference attached", async () => {
    const { status, body } = await respond(new ClientVisibleError("Resume is too short.", 400));
    expect(status).toBe(400);
    expect(body).toEqual({ error: "Resume is too short." });
  });
});
