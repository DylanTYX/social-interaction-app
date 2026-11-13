import type { UsageRecord } from "@/lib/api/token-usage";

/**
 * Turning recorded tokens into money.
 *
 * `llm_usage` has counted tokens since migration `0007`, but nothing in the
 * codebase ever multiplied them by a rate — so every dollar figure in this
 * project existed only as prose arithmetic in the documentation, unchecked
 * and uncheckable. This is the missing multiplication.
 *
 * Two deliberate properties, because a price table is the kind of constant that
 * silently goes stale:
 *
 *   1. Rates carry the date they were checked. Read it before quoting a figure.
 *   2. An unknown model returns `null`, never `0`. A model nobody priced must
 *      show up as "unpriced" in a report; silently costing it at zero would
 *      understate spend in exactly the way this file exists to prevent.
 */

/** USD per 1,000,000 tokens. */
export interface ModelPrice {
  input: number;
  /**
   * Cached input, which OpenAI bills at a discount. Kept explicit rather than
   * derived from a "50% off" rule, because that ratio is a pricing decision
   * that can change independently of the base rate.
   */
  cachedInput: number;
  /** Embedding models have no completion side; 0 is correct there, not unknown. */
  output: number;
  /**
   * GPT-5.6 and later bill tokens written to the prompt cache at 1.25x the
   * input rate (OpenAI's prompt-caching guide). Absent on earlier models, which
   * have no write charge.
   */
  cacheWrite?: number;
}

/**
 * The smallest prompt that is cached at all on GPT-5.6 and later. Below it
 * nothing is written, so nothing is billed at the write rate.
 */
export const CACHE_MIN_PROMPT_TOKENS = 1024;

/**
 * Checked against https://developers.openai.com/api/docs/pricing on 2026-10-20.
 * Note the cached-input ratio differs by family: 50% off on GPT-4o-family,
 * 90% off on GPT-5-family and later — which is part of why gpt-5-mini beats
 * gpt-4o-mini on cached-heavy traffic despite the higher list price.
 *
 * The gpt-5.6-* and gpt-6-* rows are the replacements OpenAI named for the
 * retiring defaults (see `MODEL_RETIREMENTS` in models.ts) and the cheaper
 * alternatives this project would rather move to; they are priced here so a
 * harness run on a candidate reports its cost instead of "unpriced".
 *
 * **Re-check before quoting these in a report or a viva.** If a rate has moved,
 * fix it here — every consumer reads this one table.
 */
export const PRICING_CHECKED_ON = "2026-10-20";

export const MODEL_PRICING: Record<string, ModelPrice> = {
  "gpt-6-sol": { input: 2, cachedInput: 0.2, output: 10, cacheWrite: 2.5 },
  "gpt-6-luna": { input: 0.1, cachedInput: 0.01, output: 0.5, cacheWrite: 0.125 },
  "gpt-5.6-terra": { input: 2, cachedInput: 0.2, output: 12, cacheWrite: 2.5 },
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2, cacheWrite: 0.25 },
  "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  // Evaluation only: the neutral judge for the three-way model comparison,
  // from a family none of the candidates belongs to.
  "gpt-4.1": { input: 2, cachedInput: 0.5, output: 8 },
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10 },
  "text-embedding-3-small": { input: 0.02, cachedInput: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, cachedInput: 0.13, output: 0 },
};

export interface CostBreakdown {
  /** Prompt tokens billed at the full rate. */
  uncachedInputUsd: number;
  cachedInputUsd: number;
  outputUsd: number;
  totalUsd: number;
}

/**
 * What one recorded call cost, or `null` if the model has no published rate here.
 *
 * `cachedTokens` is a *subset of* `promptTokens` (see `llm_usage` in `0001_schema.sql`), so the
 * full-rate portion is the difference. Getting that backwards would double-count
 * the cached tokens, which is the whole point of splitting them out.
 */
export function costOf(record: UsageRecord): CostBreakdown | null {
  const price = MODEL_PRICING[record.model];
  if (!price) return null;

  // Clamped because `cached > prompt` should be impossible but would produce a
  // negative charge if it ever happened.
  const cached = Math.min(record.cachedTokens, record.promptTokens);
  const uncached = record.promptTokens - cached;

  // On GPT-5.6 and later the first request of a prefix does not just miss the
  // cache, it writes to it, at a premium. The usage table stores cached tokens
  // but not written ones, so this is a rule rather than a count: in a prompt
  // long enough to be cached, everything that was not read from the cache was
  // written to it, give or take the final partial block (measured on both
  // gpt-5.6-luna and gpt-6-luna on 2026-10-19: 2,296 of 2,299 prompt tokens
  // written on the first call, 2,296 read and none written on the second).
  const uncachedRate =
    price.cacheWrite !== undefined &&
    record.promptTokens >= CACHE_MIN_PROMPT_TOKENS
      ? price.cacheWrite
      : price.input;
  const uncachedInputUsd = (uncached / 1_000_000) * uncachedRate;
  const cachedInputUsd = (cached / 1_000_000) * price.cachedInput;
  const outputUsd = (record.completionTokens / 1_000_000) * price.output;

  return {
    uncachedInputUsd,
    cachedInputUsd,
    outputUsd,
    totalUsd: uncachedInputUsd + cachedInputUsd + outputUsd,
  };
}

/**
 * What the same call would have cost with no cache hits at all.
 *
 * This is the only honest way to state a caching saving: the difference between
 * what was billed and what the identical traffic would have cost at zero cached
 * tokens. Anything else is a modelled comparison against traffic that never ran.
 *
 * Returns `null` for an unpriced model, matching `costOf`.
 */
export function costWithoutCaching(record: UsageRecord): number | null {
  const price = MODEL_PRICING[record.model];
  if (!price) return null;

  return (
    (record.promptTokens / 1_000_000) * price.input +
    (record.completionTokens / 1_000_000) * price.output
  );
}

export interface CostSummary {
  totalUsd: number;
  /** Same traffic, priced as if nothing had been cached. */
  withoutCachingUsd: number;
  /** `withoutCachingUsd - totalUsd`. Zero when caching never fired. */
  savedByCachingUsd: number;
  /** Cached ÷ prompt tokens, across every priced and unpriced record. */
  cacheHitRate: number;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  /** Models seen with no entry in `MODEL_PRICING`. Report these, never hide them. */
  unpricedModels: string[];
}

export function summariseCost(
  // `readonly` because `UsageCollector.all()` returns a readonly view and this
  // only reads.
  records: readonly UsageRecord[],
): CostSummary {
  let totalUsd = 0;
  let withoutCachingUsd = 0;
  let promptTokens = 0;
  let cachedTokens = 0;
  let completionTokens = 0;
  const unpriced = new Set<string>();

  for (const record of records) {
    promptTokens += record.promptTokens;
    cachedTokens += Math.min(record.cachedTokens, record.promptTokens);
    completionTokens += record.completionTokens;

    const cost = costOf(record);
    const uncachedCost = costWithoutCaching(record);
    if (cost === null || uncachedCost === null) {
      unpriced.add(record.model);
      continue;
    }
    totalUsd += cost.totalUsd;
    withoutCachingUsd += uncachedCost;
  }

  return {
    totalUsd,
    withoutCachingUsd,
    savedByCachingUsd: withoutCachingUsd - totalUsd,
    cacheHitRate: promptTokens > 0 ? cachedTokens / promptTokens : 0,
    promptTokens,
    cachedTokens,
    completionTokens,
    unpricedModels: [...unpriced].sort(),
  };
}

/** Six decimal places, because a turn costs fractions of a cent. */
export function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(4)}`;
}
