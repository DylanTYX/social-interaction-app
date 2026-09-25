import { describe, expect, it } from "vitest";

import { readJson } from "@/lib/api/fetch-json";
import { ApiError } from "@/lib/user-facing-error";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("readJson", () => {
  it("returns the parsed body on success", async () => {
    await expect(readJson<{ ok: boolean }>(jsonResponse({ ok: true }))).resolves.toEqual({
      ok: true,
    });
  });

  it("throws the server's own error message", async () => {
    // The point of this helper: callers get "Resume must contain at least 80
    // characters", not "HTTP 400".
    await expect(
      readJson(jsonResponse({ error: "Resume is too short." }, 400)),
    ).rejects.toThrow("Resume is too short.");
  });

  it("shows the reference a generic failure carries, and not the error class", async () => {
    // The reference matches a report to its log line. The database error
    // class says what the system is built from, so it stays in the log.
    await expect(
      readJson(
        new Response(
          JSON.stringify({
            error: "Something went wrong. Please try again.",
            ref: "a1b2c3d4",
            code: "42501",
          }),
          { status: 500 },
        ),
      ),
    ).rejects.toThrow(/^Something went wrong\. Please try again\. \(ref a1b2c3d4\)$/);
  });

  it("appends the operator hint a non-production server sends", async () => {
    await expect(
      readJson(jsonResponse({ error: "Unavailable.", ref: "a1b2c3d4", hint: "Set the key." }, 503)),
    ).rejects.toThrow("Unavailable. Set the key. (ref a1b2c3d4)");
  });

  it("throws an ApiError, the kind a screen is allowed to show", async () => {
    const error = await readJson(jsonResponse({ error: "Title cannot be empty." }, 400)).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
  });

  it("says the session expired on a 401 with no body", async () => {
    await expect(readJson(new Response("", { status: 401 }))).rejects.toThrow(
      "Your session has expired. Sign in again.",
    );
  });

  it("keeps a proxy's HTML and its status code off the screen", async () => {
    await expect(
      readJson(new Response("<html>Bad Gateway</html>", { status: 502 })),
    ).rejects.toThrow(/^Something went wrong\. Please try again\.$/);
  });
});
