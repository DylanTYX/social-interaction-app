import { describe, expect, it } from "vitest";

import type { UsageRecord } from "@/lib/api/token-usage";
import {
  costOf,
  costWithoutCaching,
  formatUsd,
  MODEL_PRICING,
  summariseCost,
} from "@/lib/pricing";

function record(partial: Partial<UsageRecord> = {}): UsageRecord {
  return {
    callSite: "interviewer",
    model: "gpt-4o-mini",
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    ...partial,
  };
}

describe("costOf", () => {
  it("prices uncached input, cached input and output separately", () => {
    // 1M prompt tokens of which 0 cached, at $0.15/1M.
    const cost = costOf(record({ promptTokens: 1_000_000 }));
    expect(cost?.uncachedInputUsd).toBeCloseTo(0.15, 10);
    expect(cost?.cachedInputUsd).toBe(0);
    expect(cost?.totalUsd).toBeCloseTo(0.15, 10);
  });

  it("treats cachedTokens as a SUBSET of promptTokens, not an addition", () => {
    // This is the arithmetic the whole file exists to get right. Migration 0007
    // documents cached_tokens as a subset; billing it as extra input would
    // roughly double the recorded prompt cost.
    const cost = costOf(
      record({ promptTokens: 1_000_000, cachedTokens: 400_000 }),
    );
    // 600k at $0.15/1M + 400k at $0.075/1M
    expect(cost?.uncachedInputUsd).toBeCloseTo(0.09, 10);
    expect(cost?.cachedInputUsd).toBeCloseTo(0.03, 10);
    expect(cost?.totalUsd).toBeCloseTo(0.12, 10);
  });

  it("never returns a negative charge if cached somehow exceeds prompt", () => {
    const cost = costOf(record({ promptTokens: 100, cachedTokens: 500 }));
    expect(cost?.uncachedInputUsd).toBe(0);
    expect(cost!.totalUsd).toBeGreaterThan(0);
  });

  it("returns null for an unpriced model rather than costing it at zero", () => {
    // The failure mode being guarded against: a new model silently reporting
    // $0.00 and understating spend in the one place built to measure it.
    expect(costOf(record({ model: "gpt-5-imaginary" }))).toBeNull();
    expect(costWithoutCaching(record({ model: "gpt-5-imaginary" }))).toBeNull();
  });

  it("prices embeddings with no output side", () => {
    const cost = costOf(
      record({
        callSite: "embedding",
        model: "text-embedding-3-small",
        promptTokens: 1_000_000,
      }),
    );
    expect(cost?.totalUsd).toBeCloseTo(0.02, 10);
    expect(cost?.outputUsd).toBe(0);
  });
});

describe("costWithoutCaching", () => {
  it("prices every prompt token at the full rate", () => {
    const withCache = costOf(
      record({ promptTokens: 1_000_000, cachedTokens: 1_000_000 }),
    );
    const without = costWithoutCaching(
      record({ promptTokens: 1_000_000, cachedTokens: 1_000_000 }),
    );
    // A fully cached prompt bills at half, so the counterfactual is double.
    expect(withCache?.totalUsd).toBeCloseTo(0.075, 10);
    expect(without).toBeCloseTo(0.15, 10);
  });
});

describe("summariseCost", () => {
  it("reports zero saving when caching never fired", () => {
    // The expected result for a session with no JD and no resume: the stable
    // prefix sits under OpenAI's 1,024-token floor, so nothing caches. The
    // report has to be able to say that plainly.
    const summary = summariseCost([
      record({ promptTokens: 3_000, completionTokens: 300 }),
      record({ callSite: "analyzer", promptTokens: 1_000 }),
    ]);
    expect(summary.cachedTokens).toBe(0);
    expect(summary.cacheHitRate).toBe(0);
    expect(summary.savedByCachingUsd).toBe(0);
    expect(summary.totalUsd).toBeCloseTo(summary.withoutCachingUsd, 12);
  });

  it("reports a real saving when it did", () => {
    const summary = summariseCost([
      record({
        promptTokens: 4_000,
        cachedTokens: 2_000,
        completionTokens: 300,
      }),
    ]);
    expect(summary.cacheHitRate).toBeCloseTo(0.5, 10);
    expect(summary.savedByCachingUsd).toBeGreaterThan(0);
  });

  it("names unpriced models instead of dropping them silently", () => {
    const summary = summariseCost([
      record({ promptTokens: 1_000 }),
      record({ model: "mystery-model", promptTokens: 1_000 }),
    ]);
    expect(summary.unpricedModels).toEqual(["mystery-model"]);
    // Its tokens still count toward the totals — only its cost is unknown.
    expect(summary.promptTokens).toBe(2_000);
  });

  it("survives an empty set without dividing by zero", () => {
    const summary = summariseCost([]);
    expect(summary.cacheHitRate).toBe(0);
    expect(summary.totalUsd).toBe(0);
  });
});

describe("the price table", () => {
  it("prices every model the app can actually call", () => {
    // Defaults from chat/route.ts, response-analyzer.ts, summary.ts,
    // coach/model-answer/route.ts, resume-profile.ts and embeddings.ts.
    for (const model of ["gpt-4o-mini", "text-embedding-3-small"]) {
      expect(MODEL_PRICING[model], `no price for ${model}`).toBeTruthy();
    }
  });

  it("never prices cached input above uncached input", () => {
    for (const [model, price] of Object.entries(MODEL_PRICING)) {
      expect(price.cachedInput, `${model} cached > input`).toBeLessThanOrEqual(
        price.input,
      );
    }
  });
});

describe("formatUsd", () => {
  it("keeps enough precision to show a per-turn cost", () => {
    // At ~$0.0007 a turn, two decimal places would render every turn as $0.00.
    expect(formatUsd(0.0007)).toBe("$0.000700");
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(1.2345)).toBe("$1.2345");
  });
});
