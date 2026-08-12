import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { UsageCollector } from "@/lib/api/token-usage";

/**
 * `flush` only ever calls `rpc("record_llm_usage", …)`, so a stub with that one
 * path is enough. It used to call `from(...).insert(...)` directly; that
 * privilege was revoked from `authenticated` because it applied equally to the
 * browser, which made the cost figures forgeable by the person they describe.
 */
function stubSupabase(rpc: () => Promise<unknown>) {
  const spy = vi.fn(rpc);
  return { rpc: spy, client: { rpc: spy } as unknown as SupabaseClient };
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

  it("writes one batched call and then empties", async () => {
    const supabase = stubSupabase(() => Promise.resolve({ error: null }));

    const collector = new UsageCollector();
    collector.record("interviewer", "gpt-4o-mini", { prompt_tokens: 100 });
    collector.record("analyzer", "gpt-4o-mini", { prompt_tokens: 200 });

    await collector.flush(supabase.client, { sessionId: "s1" });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = supabase.rpc.mock.calls[0] as unknown as [
      string,
      { p_rows: Array<Record<string, unknown>> },
    ];
    expect(fn).toBe("record_llm_usage");
    expect(args.p_rows).toHaveLength(2);
    expect(args.p_rows[0]).toMatchObject({
      session_id: "s1",
      call_site: "interviewer",
    });

    // The security property: the row is attributed to `auth.uid()` inside the
    // function, so a caller-supplied user id would be a value the database
    // ignores. It must not be sent at all.
    expect(args.p_rows[0]).not.toHaveProperty("user_id");

    // Flushing twice must not double-write.
    await collector.flush(supabase.client, { sessionId: "s1" });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("never throws when the write fails", async () => {
    const supabase = stubSupabase(() =>
      Promise.reject(new Error("connection lost")),
    );

    const collector = new UsageCollector();
    collector.record("interviewer", "gpt-4o-mini", { prompt_tokens: 100 });

    // Accounting must not be able to fail a turn that already produced an
    // answer for the user.
    await expect(
      collector.flush(supabase.client),
    ).resolves.toBeUndefined();
  });

  it("skips the write entirely when nothing was recorded", async () => {
    const supabase = stubSupabase(() => Promise.resolve({ error: null }));
    const collector = new UsageCollector();

    await collector.flush(supabase.client);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
