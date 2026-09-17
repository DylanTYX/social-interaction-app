import { describe, expect, it } from "vitest";

import type { UsageRecord } from "@/lib/api/token-usage";
import { MODEL_PRICING } from "@/lib/pricing";
import { summariseUsage } from "@/lib/usage-summary";

const record = (over: Partial<UsageRecord> = {}): UsageRecord => ({
  callSite: "interviewer",
  model: "gpt-5-mini",
  promptTokens: 1_000,
  completionTokens: 200,
  cachedTokens: 0,
  ...over,
});

describe("summariseUsage", () => {
  it("says nothing happened when nothing has", () => {
    const summary = summariseUsage([]);
    expect(summary.calls).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.costUsd).toBeNull();
    expect(summary.purposes).toEqual([]);
  });

  it("totals tokens and prices them at the published rate", () => {
    const summary = summariseUsage([record()]);

    expect(summary.totalTokens).toBe(1_200);
    const price = MODEL_PRICING["gpt-5-mini"];
    const expected =
      (1_000 / 1_000_000) * price.input + (200 / 1_000_000) * price.output;
    expect(summary.costUsd).toBeCloseTo(expected, 10);
  });

  it("groups by what the tokens bought, biggest first", () => {
    const summary = summariseUsage([
      record({ callSite: "interviewer", promptTokens: 500 }),
      record({
        callSite: "analyzer",
        model: "gpt-4o-mini",
        promptTokens: 4000,
      }),
      record({
        callSite: "analyzer",
        model: "gpt-4o-mini",
        promptTokens: 3000,
      }),
    ]);

    expect(summary.purposes.map((purpose) => purpose.label)).toEqual([
      "Scoring your answers",
      "Asking questions",
    ]);
    expect(summary.purposes[0].calls).toBe(2);
    expect(summary.purposes[0].totalTokens).toBe(7_400);
  });

  it("names a retired call site rather than dropping its rows", () => {
    // Historic rows carry call sites the code no longer writes. A total that
    // quietly omitted them would understate what was spent.
    const summary = summariseUsage([
      record({ callSite: "resume-profile" as UsageRecord["callSite"] }),
    ]);
    expect(summary.purposes[0].label).toContain("retired");
    expect(summary.calls).toBe(1);
  });

  it("reports a caching saving only when every model is priced", () => {
    const cached = summariseUsage([record({ cachedTokens: 800 })]);
    expect(cached.savedByCachingUsd).toBeGreaterThan(0);
    expect(cached.withoutCachingUsd).toBeGreaterThan(cached.costUsd ?? 0);

    const mixed = summariseUsage([
      record(),
      record({ model: "some-unpriced-model" }),
    ]);
    expect(mixed.unpricedModels).toEqual(["some-unpriced-model"]);
    expect(mixed.savedByCachingUsd).toBeNull();
    // The priced half is still costed, so the figure is a floor, not a blank.
    expect(mixed.costUsd).toBeGreaterThan(0);
  });

  it("carries the date the rates were checked", () => {
    expect(summariseUsage([record()]).pricingCheckedOn).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
