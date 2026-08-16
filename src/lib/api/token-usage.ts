import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Token accounting for OpenAI calls.
 *
 * Every OpenAI response carries a `usage` block and the app used to throw all
 * of it away, which made cost claims unmeasurable. A `UsageCollector` is
 * created per request, passed to whichever helpers make model calls, and
 * flushed once at the end — so a turn that makes three calls costs one extra
 * insert, not three.
 *
 * Recording is always best-effort: a failure here must never break an
 * interview turn.
 */

/** Logical call sites, so a turn can be costed by component. */
export type LlmCallSite =
  | "interviewer"
  | "analyzer"
  | "summary"
  | "embedding"
  | "coach"
  // Upload-time: stripping page furniture out of a pasted job posting.
  //
  // `resume-profile` used to sit here too. It distilled a CV into a summary the
  // interviewer read *instead of* the CV, which is why it is gone rather than
  // merely unused. The DB check constraint still permits the value, so historic
  // rows keep reporting correctly in the cost report.
  | "jd-clean";

/** The shape OpenAI returns on both chat completions and embeddings. */
export interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export interface UsageRecord {
  callSite: LlmCallSite;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

function toInt(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

export class UsageCollector {
  private records: UsageRecord[] = [];

  record(
    callSite: LlmCallSite,
    model: string,
    usage: OpenAIUsage | null | undefined,
  ): void {
    if (!usage) return;
    this.records.push({
      callSite,
      model,
      promptTokens: toInt(usage.prompt_tokens),
      completionTokens: toInt(usage.completion_tokens),
      cachedTokens: toInt(usage.prompt_tokens_details?.cached_tokens),
    });
  }

  /** Everything collected so far. Useful in tests and for logging. */
  all(): readonly UsageRecord[] {
    return this.records;
  }

  totals(): { promptTokens: number; completionTokens: number; cachedTokens: number } {
    return this.records.reduce(
      (acc, r) => ({
        promptTokens: acc.promptTokens + r.promptTokens,
        completionTokens: acc.completionTokens + r.completionTokens,
        cachedTokens: acc.cachedTokens + r.cachedTokens,
      }),
      { promptTokens: 0, completionTokens: 0, cachedTokens: 0 },
    );
  }

  /**
   * Write the batch. Never throws — accounting must not be able to fail a
   * request that already produced a good answer for the user.
   */
  /**
   * `userId` is deliberately not a parameter: `record_llm_usage` attributes
   * every row to `auth.uid()` server-side, so passing one would be a value the
   * database ignores — and a caller could reasonably expect it to be honoured.
   */
  async flush(
    supabase: SupabaseClient,
    context: { sessionId?: string | null } = {},
  ): Promise<void> {
    if (this.records.length === 0) return;

    // No `user_id`: `record_llm_usage` attributes every row to `auth.uid()`
    // itself, so the caller cannot write usage against someone else — and, more
    // to the point, cannot write it at all except through this function.
    const rows = this.records.map((r) => ({
      session_id: context.sessionId ?? null,
      call_site: r.callSite,
      model: r.model,
      prompt_tokens: r.promptTokens,
      completion_tokens: r.completionTokens,
      cached_tokens: r.cachedTokens,
    }));

    this.records = [];

    try {
      /**
       * Through an RPC because `authenticated` no longer holds `insert` on
       * `llm_usage`. It held it for the API and therefore for the browser too,
       * which made the cost figures forgeable by the person they describe — an
       * awkward property for numbers presented as measured fact.
       */
      const { error } = await supabase.rpc("record_llm_usage", {
        p_rows: rows,
      });
      if (error) {
        console.warn("[token-usage] insert failed:", error.message);
      }
    } catch (error) {
      console.warn("[token-usage] insert threw:", error);
    }
  }
}
