import { describe, expect, it, vi } from "vitest";

import { UsageCollector } from "@/lib/api/token-usage";

describe("UsageCollector", () => {
  it("records a usage block", () => {
    const collector = new UsageCollector();
    collector.record("analyzer", "gpt-4o-mini", {
      prompt_tokens: 2200,
      completion_tokens: 480,
      prompt_tokens_details: { cached_tokens: 1024 },
    });

    expect(collector.all()).toEqual([
      {
        callSite: "analyzer",
        model: "gpt-4o-mini",
        promptTokens: 2200,
        completionTokens: 480,
        cachedTokens: 1024,
      },
    ]);
  });

  it("ignores a missing usage block", () => {
    const collector = new UsageCollector();
    collector.record("interviewer", "gpt-4o-mini", null);
    collector.record("interviewer", "gpt-4o-mini", undefined);

    expect(collector.all()).toHaveLength(0);
  });

  it("defaults absent or non-numeric fields to zero", () => {
    const collector = new UsageCollector();
    collector.record("summary", "gpt-4o-mini", { prompt_tokens: 800 });

    expect(collector.all()[0]).toMatchObject({
      promptTokens: 800,
      completionTokens: 0,
      cachedTokens: 0,
    });
  });

  it("sums a turn across its call sites", () => {
    const collector = new UsageCollector();
    collector.record("interviewer", "gpt-4o-mini", {
      prompt_tokens: 4300,
      completion_tokens: 250,
      prompt_tokens_details: { cached_tokens: 2048 },
    });
    collector.record("analyzer", "gpt-4o-mini", {
      prompt_tokens: 2200,
      completion_tokens: 500,
    });

    expect(collector.totals()).toEqual({
      promptTokens: 6500,
      completionTokens: 750,
      cachedTokens: 2048,
    });
  });

  it("writes one batched insert and then empties", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) };

    const collector = new UsageCollector();
    collector.record("interviewer", "gpt-4o-mini", { prompt_tokens: 100 });
    collector.record("analyzer", "gpt-4o-mini", { prompt_tokens: 200 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await collector.flush(supabase as any, { userId: "u1", sessionId: "s1" });

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toHaveLength(2);
    expect(insert.mock.calls[0][0][0]).toMatchObject({
      user_id: "u1",
      session_id: "s1",
      call_site: "interviewer",
    });

    // Flushing twice must not double-write.
    await collector.flush(supabase as any, { userId: "u1", sessionId: "s1" });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("never throws when the write fails", async () => {
    const supabase = {
      from: () => ({
        insert: vi.fn().mockRejectedValue(new Error("connection lost")),
      }),
    };

    const collector = new UsageCollector();
    collector.record("interviewer", "gpt-4o-mini", { prompt_tokens: 100 });

    // Accounting must not be able to fail a turn that already produced an
    // answer for the user.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(
      collector.flush(supabase as any, { userId: "u1" }),
    ).resolves.toBeUndefined();
  });

  it("skips the write entirely when nothing was recorded", async () => {
    const supabase = { from: vi.fn() };
    const collector = new UsageCollector();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await collector.flush(supabase as any, { userId: "u1" });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
