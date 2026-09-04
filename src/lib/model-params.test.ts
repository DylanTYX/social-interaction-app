import { describe, expect, it } from "vitest";

import { completionParams, isReasoningModel } from "@/lib/model-params";

describe("isReasoningModel", () => {
  it("recognises the GPT-5 family and the o-series", () => {
    expect(isReasoningModel("gpt-5-mini")).toBe(true);
    expect(isReasoningModel("gpt-5-nano")).toBe(true);
    expect(isReasoningModel("gpt-5")).toBe(true);
    expect(isReasoningModel("o3-mini")).toBe(true);
  });

  it("treats the GPT-4 family as non-reasoning", () => {
    expect(isReasoningModel("gpt-4o-mini")).toBe(false);
    expect(isReasoningModel("gpt-4o")).toBe(false);
  });
});

describe("completionParams", () => {
  it("sends temperature and max_tokens to a GPT-4-family model", () => {
    expect(
      completionParams("gpt-4o-mini", { temperature: 0.7, maxTokens: 320 }),
    ).toEqual({ temperature: 0.7, max_tokens: 320 });
  });

  it("never sends temperature to a reasoning model — it 400s", () => {
    const params = completionParams("gpt-5-mini", {
      temperature: 0.7,
      maxTokens: 320,
    });
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("max_tokens");
    expect(params.reasoning_effort).toBe("minimal");
  });

  it("keeps the caller's cap intact at minimal effort", () => {
    expect(
      completionParams("gpt-5-mini", { temperature: 0, maxTokens: 320 }),
    ).toMatchObject({ max_completion_tokens: 320 });
  });

  it("adds headroom above minimal, because reasoning bills inside the cap", () => {
    const params = completionParams("gpt-5-mini", {
      temperature: 0.5,
      maxTokens: 1000,
      reasoningEffort: "low",
    });
    expect(params.reasoning_effort).toBe("low");
    expect(params.max_completion_tokens).toBeGreaterThan(1000);
  });
});
