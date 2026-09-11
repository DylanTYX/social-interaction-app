import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { updateSession } from "@/lib/db/sessions";

/**
 * `updateSession` goes through an RPC, not a table update.
 *
 * `0002_security.sql` revokes `update` on `interview_sessions` from
 * `authenticated`, because that privilege applied equally to the browser — a
 * signed-in user could set `average_score` or write `launch_meta.loopBrief`
 * (which reaches the interviewer's *stable* system prompt) straight through
 * PostgREST, making every check in the API layer advisory.
 *
 * So this path is now load-bearing in a way it was not before: if the function
 * name or the argument shape drifts, every session update fails at runtime with
 * a permission error rather than a type error. Hence a test.
 */

function stubSupabase() {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const single = vi.fn().mockResolvedValue({
    data: {
      id: "s1",
      user_id: "u1",
      practice_mode: "text",
      scenario_value: "custom",
      scenario_title: null,
      scenario_description: null,
      persona_id: null,
      persona_name: "Sarah Chen",
      persona_config: {},
      status: "completed",
      turn_count: 12,
      summary: null,
      metrics: null,
      launch_meta: null,
      loop_id: null,
      loop_progress: null,
      competency_coverage: null,
      average_score: 80,
      duration_minutes: 20,
      job_description_id: null,
      resume_id: null,
      started_at: "2026-01-01T00:00:00Z",
      ended_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    error: null,
  });

  const builder = {
    select: () => builder,
    eq: () => builder,
    single,
  };
  const from = vi.fn(() => builder);

  return { rpc, from, client: { rpc, from } as unknown as SupabaseClient };
}

describe("updateSession", () => {
  it("writes through update_session_progress rather than .update()", async () => {
    const supabase = stubSupabase();

    await updateSession(supabase.client, "s1", { averageScore: 80 });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = supabase.rpc.mock.calls[0] as unknown as [
      string,
      { p_session_id: string; p_patch: Record<string, unknown> },
    ];
    expect(fn).toBe("update_session_progress");
    expect(args.p_session_id).toBe("s1");
    expect(args.p_patch).toEqual({ average_score: 80 });
  });

  it("sends only the columns the caller named", async () => {
    // "Key present" semantics: the function leaves a column alone when its key
    // is absent, so sending everything would clobber whatever it did not know.
    const supabase = stubSupabase();

    await updateSession(supabase.client, "s1", { summary: "a recap" });

    const [, args] = supabase.rpc.mock.calls[0] as unknown as [
      string,
      { p_patch: Record<string, unknown> },
    ];
    expect(Object.keys(args.p_patch)).toEqual(["summary"]);
  });

  it("distinguishes an explicit null from an omitted field", async () => {
    // `endedAt: null` means "clear it"; not mentioning `endedAt` means "leave
    // it". The jsonb patch has to preserve that difference.
    const supabase = stubSupabase();

    await updateSession(supabase.client, "s1", { endedAt: null });

    const [, args] = supabase.rpc.mock.calls[0] as unknown as [
      string,
      { p_patch: Record<string, unknown> },
    ];
    expect(args.p_patch).toHaveProperty("ended_at", null);
  });

  it("surfaces an RPC failure instead of returning a stale row", async () => {
    const supabase = stubSupabase();
    supabase.rpc.mockResolvedValue({ error: new Error("permission denied") });

    await expect(
      updateSession(supabase.client, "s1", { averageScore: 80 }),
    ).rejects.toThrow();
  });
});
