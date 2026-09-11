import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A missing or rejected key used to reach the candidate as "Something went
 * wrong. Please try again." — the generic 500 — so a misconfigured Vercel
 * deployment failed on the interviewer's first word with no way to tell why.
 * These pin that configuration failures say what to fix, and that everything
 * else still falls through to the generic path.
 */

import { ClientVisibleError, handleRouteError } from "@/lib/api/errors";
import { missingOpenAIKey, openAIResponseError } from "@/lib/api/openai-errors";

afterEach(() => vi.restoreAllMocks());

async function bodyOf(error: Error) {
  const response = handleRouteError("test", error);
  return { status: response.status, body: (await response.json()) as { error: string } };
}

describe("OpenAI configuration failures reach the client", () => {
  it("names the missing key and the redeploy, not a generic failure", async () => {
    const { status, body } = await bodyOf(missingOpenAIKey());
    expect(status).toBe(503);
    expect(body.error).toMatch(/OPENAI_API_KEY/);
    expect(body.error).toMatch(/redeploy/i);
    expect(body.error).not.toMatch(/something went wrong/i);
  });

  it.each([
    [401, /rejected this deployment's API key/],
    [429, /rate-limited or out of credit/],
    [404, /cannot use the gpt-5-mini model/],
  ])("explains an OpenAI %i", async (status, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = openAIResponseError(status, "{}", { model: "gpt-5-mini", call: "interviewer" });
    expect(error).toBeInstanceOf(ClientVisibleError);
    expect((await bodyOf(error)).body.error).toMatch(message);
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
