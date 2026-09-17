import type { SupabaseClient } from "@supabase/supabase-js";

import type { UsageRecord } from "@/lib/api/token-usage";

/**
 * Reading back what `record_llm_usage` wrote.
 *
 * Row-level security scopes every read to the caller, so no `user_id` filter
 * appears here: a query that forgot one would return nothing rather than
 * someone else's rows.
 */

/**
 * Enough rows to cover a heavy month of practice without an unbounded read.
 * A turn writes two to four rows, so this is roughly 1,500 turns.
 */
export const MAX_USAGE_ROWS = 5_000;

export interface UsageQuery {
  /** Only calls at or after this instant. */
  since?: Date | null;
  /** Only calls made for this session. */
  sessionId?: string | null;
}

export async function listUsage(
  supabase: SupabaseClient,
  { since, sessionId }: UsageQuery = {},
): Promise<UsageRecord[]> {
  let request = supabase
    .from("llm_usage")
    .select("call_site, model, prompt_tokens, completion_tokens, cached_tokens")
    .order("created_at", { ascending: false })
    .limit(MAX_USAGE_ROWS);

  if (since) request = request.gte("created_at", since.toISOString());
  if (sessionId) request = request.eq("session_id", sessionId);

  const { data, error } = await request;
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    // The call site is a free-text column with a check constraint, and it
    // carries values retired from the union (see `token-usage.ts`). Read it as
    // text and let the summariser decide what to call it.
    callSite: String(row.call_site ?? "") as UsageRecord["callSite"],
    model: String(row.model ?? ""),
    promptTokens: Number(row.prompt_tokens ?? 0),
    completionTokens: Number(row.completion_tokens ?? 0),
    cachedTokens: Number(row.cached_tokens ?? 0),
  }));
}
