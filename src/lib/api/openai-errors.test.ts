import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A missing or rejected key used to reach the candidate as "Something went
 * wrong. Please try again." — the generic 500 — so a misconfigured Vercel
 * deployment failed on the interviewer's first word with no way to tell why.
 * These pin that a configuration failure says what to fix to the person who
 * can fix it, and says nothing about the system to anyone else.
 */

import { ClientVisibleError, handleRouteError } from "@/lib/api/errors";
import { missingOpenAIKey, openAIResponseError } from "@/lib/api/openai-errors";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function bodyOf(error: Error) {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = handleRouteError("test", error);
  return {
    status: response.status,
    body: (await response.json()) as { error: string; ref?: string; hint?: string },
  };
}

const SYSTEM_DETAIL = /openai|api.?key|OPENAI_API_KEY|vercel|redeploy|billing|credit|gpt-/i;

describe("OpenAI configuration failures", () => {
  it("name the missing key and the redeploy outside production", async () => {
    const { status, body } = await bodyOf(missingOpenAIKey());
    expect(status).toBe(503);
    expect(body.hint).toMatch(/OPENAI_API_KEY/);
    expect(body.hint).toMatch(/redeploy/i);
    expect(body.error).not.toMatch(/something went wrong/i);
  });

  it.each([
    [401, /rejected this deployment's API key/],
    [429, /rate-limited or out of credit/],
    [404, /cannot use the gpt-5-mini model/],
  ])("explain an OpenAI %i outside production", async (status, hint) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = openAIResponseError(status, "{}", { model: "gpt-5-mini", call: "interviewer" });
    expect(error).toBeInstanceOf(ClientVisibleError);
    expect((await bodyOf(error)).body.hint).toMatch(hint);
  });

  it("tell a candidate nothing about the system, whatever the environment", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const errors = [
      missingOpenAIKey(),
      ...[401, 403, 404, 429].map((status) =>
        openAIResponseError(status, "{}", { model: "gpt-5-mini", call: "interviewer" }),
      ),
    ];
    for (const error of errors) expect(error.message).not.toMatch(SYSTEM_DETAIL);
  });

  it("send only the message and a reference in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = handleRouteError("test", missingOpenAIKey());
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(SYSTEM_DETAIL);
    expect(Object.keys(body).sort()).toEqual(["error", "ref"]);
    expect(String(log.mock.calls[0][0])).toContain("OPENAI_API_KEY");
  });
});

describe("everything else stays opaque", () => {
  it("keeps an OpenAI 500 on the generic path and out of the response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = openAIResponseError(500, '{"error":{"message":"org-secret"}}', { call: "interviewer" });
    expect(error).not.toBeInstanceOf(ClientVisibleError);
    const { status, body } = await bodyOf(error);
    expect(status).toBe(500);
    expect(body.error).not.toMatch(/org-secret/);
  });

  it("never puts the raw OpenAI body in a client-visible message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const status of [401, 403, 404, 429]) {
      const error = openAIResponseError(status, "org-abc123 proj-xyz", { call: "interviewer" });
      expect(error.message).not.toMatch(/org-abc123|proj-xyz/);
    }
  });
});
