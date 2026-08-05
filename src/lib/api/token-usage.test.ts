import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { UsageCollector } from "@/lib/api/token-usage";

/**
 * `flush` only ever calls `from(...).insert(...)`, so a stub with that one
 * path is enough. Narrowing through `unknown` in this single helper keeps the
 * cast out of the tests themselves.
 */
function stubSupabase(insert: () => Promise<unknown>) {
  const from = vi.fn(() => ({ insert }));
  return { from, client: { from } as unknown as SupabaseClient };
}

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
    const supabase = stubSupabase(insert);

    const collector = new UsageCollector();
    collector.record("interviewer", "gpt-4o-mini", { prompt_tokens: 100 });
    collector.record("analyzer", "gpt-4o-mini", { prompt_tokens: 200 });

    await collector.flush(supabase.client, { userId: "u1", sessionId: "s1" });

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toHaveLength(2);
    expect(insert.mock.calls[0][0][0]).toMatchObject({
      user_id: "u1",
      session_id: "s1",
      call_site: "interviewer",
    });

    // Flushing twice must not double-write.
    await collector.flush(supabase.client, { userId: "u1", sessionId: "s1" });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("never throws when the write fails", async () => {
    const supabase = stubSupabase(
      vi.fn().mockRejectedValue(new Error("connection lost")),
    );

    const collector = new UsageCollector();
    collector.record("interviewer", "gpt-4o-mini", { prompt_tokens: 100 });

    // Accounting must not be able to fail a turn that already produced an
    // answer for the user.
    await expect(
      collector.flush(supabase.client, { userId: "u1" }),
    ).resolves.toBeUndefined();
  });

  it("skips the write entirely when nothing was recorded", async () => {
    const supabase = stubSupabase(vi.fn());
    const collector = new UsageCollector();

    await collector.flush(supabase.client, { userId: "u1" });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
