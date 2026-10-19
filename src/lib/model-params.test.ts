import { describe, expect, it } from "vitest";

import {
  completionParams,
  isReasoningModel,
  modelFamily,
  modelGeneration,
} from "@/lib/model-params";

describe("modelGeneration", () => {
  it("places the GPT-4 family in the classic contract", () => {
    expect(modelGeneration("gpt-4o-mini")).toBe("classic");
    expect(modelGeneration("gpt-4o")).toBe("classic");
    expect(modelGeneration("gpt-4.1-mini")).toBe("classic");
    expect(modelGeneration("text-embedding-3-small")).toBe("classic");
  });

  it("places the original GPT-5 models and the o-series in the gpt-5 contract", () => {
    expect(modelGeneration("gpt-5-mini")).toBe("gpt-5");
    expect(modelGeneration("gpt-5-nano")).toBe("gpt-5");
    expect(modelGeneration("gpt-5")).toBe("gpt-5");
    expect(modelGeneration("o3-mini")).toBe("gpt-5");
  });

  it("places point releases and GPT-6 in the current contract", () => {
    expect(modelGeneration("gpt-5.1")).toBe("current");
    expect(modelGeneration("gpt-5.4-mini")).toBe("current");
    expect(modelGeneration("gpt-5.6-luna")).toBe("current");
    expect(modelGeneration("gpt-5.6-terra")).toBe("current");
    expect(modelGeneration("gpt-6-luna")).toBe("current");
    expect(modelGeneration("gpt-6.1-sol")).toBe("current");
  });
});

describe("isReasoningModel", () => {
  it("is true for every generation after the classic one", () => {
    expect(isReasoningModel("gpt-5-mini")).toBe(true);
    expect(isReasoningModel("gpt-6-luna")).toBe(true);
    expect(isReasoningModel("o3-mini")).toBe(true);
  });

  it("treats the GPT-4 family as non-reasoning", () => {
    expect(isReasoningModel("gpt-4o-mini")).toBe(false);
    expect(isReasoningModel("gpt-4o")).toBe(false);
  });
});

describe("modelFamily", () => {
  it("reduces a model to its major generation", () => {
    expect(modelFamily("gpt-4o-mini")).toBe("gpt-4");
    expect(modelFamily("gpt-5-mini")).toBe("gpt-5");
    expect(modelFamily("gpt-5.6-luna")).toBe("gpt-5");
    expect(modelFamily("gpt-6-luna")).toBe("gpt-6");
    expect(modelFamily("o3-mini")).toBe("o3");
  });

  it("keeps the judge off the generation it judges", () => {
    // The pairing the migration plans: interviewer on gpt-5.6-luna, judge on
    // gpt-6-luna. The pairing the committed persona run used by accident:
    // gpt-4o-mini judging gpt-4o-mini.
    expect(modelFamily("gpt-5.6-luna")).not.toBe(modelFamily("gpt-6-luna"));
    expect(modelFamily("gpt-4o-mini")).toBe(modelFamily("gpt-4o-mini"));
  });
});

describe("completionParams", () => {
  it("sends temperature and max_tokens to a GPT-4-family model", () => {
    expect(
      completionParams("gpt-4o-mini", { temperature: 0.7, maxTokens: 320 }),
    ).toEqual({ temperature: 0.7, max_tokens: 320 });
  });

  it("never sends temperature to a gpt-5 generation model — it 400s", () => {
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

  it("says `none` to the current generation where a gpt-5 call said `minimal`", () => {
    // `minimal` no longer exists there, and `none` is the one effort at which
    // the sampling parameters apply — so the assessor's temperature 0.1 comes
    // back into force on gpt-6-luna instead of being silently dropped.
    expect(
      completionParams("gpt-6-luna", { temperature: 0.1, maxTokens: 900 }),
    ).toEqual({
      temperature: 0.1,
      max_completion_tokens: 900,
      reasoning_effort: "none",
    });
    expect(
      completionParams("gpt-5.6-luna", {
        temperature: 0.7,
        maxTokens: 320,
        reasoningEffort: "minimal",
      }),
    ).toEqual({
      temperature: 0.7,
      max_completion_tokens: 320,
      reasoning_effort: "none",
    });
  });

  it("drops temperature on the current generation once reasoning is on", () => {
    const params = completionParams("gpt-5.6-luna", {
      temperature: 0.5,
      maxTokens: 1000,
      reasoningEffort: "low",
    });
    expect(params).not.toHaveProperty("temperature");
    expect(params.reasoning_effort).toBe("low");
    expect(params.max_completion_tokens).toBeGreaterThan(1000);
  });

  it("falls back to `low` on the models that reject `none`", () => {
    for (const model of ["gpt-6-astra", "gpt-6.1-sol"]) {
      const params = completionParams(model, {
        temperature: 0.1,
        maxTokens: 900,
      });
      expect(params).not.toHaveProperty("temperature");
      expect(params.reasoning_effort).toBe("low");
      expect(params.max_completion_tokens).toBeGreaterThan(900);
    }
  });
});
