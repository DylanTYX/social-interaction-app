import type { UsageRecord } from "@/lib/api/token-usage";

/**
 * Turning recorded tokens into money.
 *
 * `llm_usage` has counted tokens since migration `0007`, but nothing in the
 * codebase ever multiplied them by a rate — so every dollar figure in this
 * project existed only as prose arithmetic in `docs/TOKEN-COST.md`, unchecked
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
}

/**
 * Checked against https://openai.com/api/pricing on 2026-08-07.
 *
 * **Re-check before quoting these in a report or a viva.** If a rate has moved,
 * fix it here — every consumer reads this one table.
 */
export const PRICING_CHECKED_ON = "2026-08-07";

export const MODEL_PRICING: Record<string, ModelPrice> = {
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
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
 * `cachedTokens` is a *subset of* `promptTokens` (see migration `0007`), so the
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

  const uncachedInputUsd = (uncached / 1_000_000) * price.input;
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
