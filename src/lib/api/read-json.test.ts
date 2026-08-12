import { describe, expect, it } from "vitest";

import { ClientVisibleError } from "@/lib/api/errors";
import { MAX_JSON_BODY_BYTES, readJsonBody } from "@/lib/api/read-json";

/**
 * The body cap.
 *
 * App Router handlers have no default body limit — the familiar 4 MB ceiling is
 * a Pages/Server-Actions thing — so every route here parsed whatever it was
 * sent and only then validated the field lengths. These tests pin the two
 * checks that matter, and in particular the one that survives a client which
 * lies about (or omits) `Content-Length`.
 */

function jsonRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("readJsonBody", () => {
  it("parses a normal body", async () => {
    const parsed = await readJsonBody<{ userMessage: string }>(
      jsonRequest(JSON.stringify({ userMessage: "hello" })),
    );
    expect(parsed.userMessage).toBe("hello");
  });

  it("rejects on Content-Length before reading anything", async () => {
    // The cheap check. It is a hint, not a guarantee — hence the next test.
    const request = jsonRequest("{}", {
      "content-length": String(MAX_JSON_BODY_BYTES + 1),
    });

    await expect(readJsonBody(request)).rejects.toBeInstanceOf(
      ClientVisibleError,
    );
  });

  it("rejects an oversize body whose Content-Length is absent", async () => {
    // The check that actually holds: a chunked request declares no length, so
    // the header test above passes and the stream count is the only guard.
    const oversize = JSON.stringify({ blob: "x".repeat(2000) });

    await expect(
      readJsonBody(jsonRequest(oversize), 512),
    ).rejects.toBeInstanceOf(ClientVisibleError);
  });

  it("reports a 413 rather than a generic 400 when too large", async () => {
    // The status the caller surfaces; "too large" and "malformed" are different
    // problems and the user can only act on one of them.
    await expect(
      readJsonBody(jsonRequest(JSON.stringify({ a: "x".repeat(600) })), 128),
    ).rejects.toMatchObject({ status: 413 });
  });

  it("reports malformed JSON as a 400, not a crash", async () => {
    await expect(readJsonBody(jsonRequest("{not json"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("accepts a body exactly at the limit", async () => {
    // Off-by-one guard: the cap is a maximum, not an exclusive bound.
    const body = JSON.stringify({ a: "x" });
    const parsed = await readJsonBody<{ a: string }>(
      jsonRequest(body),
      Buffer.byteLength(body),
    );
    expect(parsed.a).toBe("x");
  });
});
