import type { UsageRecord } from "@/lib/api/token-usage";
import {
  costOf,
  PRICING_CHECKED_ON,
  summariseCost,
  type CostSummary,
} from "@/lib/pricing";

/**
 * Recorded model calls, turned into something a candidate can read.
 *
 * Server-only, like the price table it reads. A lint rule keeps both out of
 * `src/components` and out of every page, so the rate card cannot reach a
 * browser bundle; the API route under `src/app/api` is the one caller, and it
 * sends the finished figures rather than the rates. See `eslint.config.mjs`.
 *
 * Call sites are internal names — "analyzer", "jd-clean" — so each is given a
 * label saying what the tokens bought. `resume-profile` is a retired call site
 * that historic rows still carry; it is named rather than dropped, because a
 * total that silently omits rows is worse than one that explains them.
 */

const PURPOSE_LABELS: Record<string, string> = {
  interviewer: "Asking questions",
  analyzer: "Scoring your answers",
  coach: "Coaching and stronger answers",
  summary: "Keeping track of the conversation",
  embedding: "Reading your job description",
  "jd-clean": "Tidying a pasted job description",
  "resume-profile": "Reading your resume (retired)",
};

export function purposeLabel(callSite: string): string {
  return PURPOSE_LABELS[callSite] ?? callSite;
}

export interface UsagePurpose {
  callSite: string;
  label: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  /** Prompt plus completion: the figure the UI shows as "tokens". */
  totalTokens: number;
  /** Null when no model in this group has a published rate. */
  costUsd: number | null;
}

export interface UsageSummary {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  /** Null when nothing in the window could be priced. */
  costUsd: number | null;
  /** The same traffic priced as if nothing had been cached. */
  withoutCachingUsd: number | null;
  savedByCachingUsd: number | null;
  cacheHitRate: number;
  /** Models with no published rate here. Named, never hidden. */
  unpricedModels: string[];
  /** When the rates behind `costUsd` were last checked, as ISO yyyy-mm-dd. */
  pricingCheckedOn: string;
  purposes: UsagePurpose[];
}

/** Costs a group, returning null when no record in it has a rate. */
function groupCost(records: UsageRecord[]): number | null {
  let total = 0;
  let priced = false;
  for (const record of records) {
    const cost = costOf(record);
    if (cost === null) continue;
    priced = true;
    total += cost.totalUsd;
  }
  return priced ? total : null;
}

export function summariseUsage(records: readonly UsageRecord[]): UsageSummary {
  const byPurpose = new Map<string, UsageRecord[]>();
  for (const record of records) {
    const existing = byPurpose.get(record.callSite);
    if (existing) existing.push(record);
    else byPurpose.set(record.callSite, [record]);
  }

  const purposes: UsagePurpose[] = [...byPurpose.entries()]
    .map(([callSite, group]) => {
      const promptTokens = group.reduce((sum, r) => sum + r.promptTokens, 0);
      const completionTokens = group.reduce(
        (sum, r) => sum + r.completionTokens,
        0,
      );
      return {
        callSite,
        label: purposeLabel(callSite),
        calls: group.length,
        promptTokens,
        completionTokens,
        cachedTokens: group.reduce((sum, r) => sum + r.cachedTokens, 0),
        totalTokens: promptTokens + completionTokens,
        costUsd: groupCost(group),
      };
    })
    // Biggest first: what to look at is what costs the most.
    .sort((a, b) => b.totalTokens - a.totalTokens);

  const cost: CostSummary = summariseCost(records);
  const priced = records.length > 0 && cost.unpricedModels.length < 1;
  const anyPriced = purposes.some((purpose) => purpose.costUsd !== null);

  return {
    calls: records.length,
    promptTokens: cost.promptTokens,
    completionTokens: cost.completionTokens,
    cachedTokens: cost.cachedTokens,
    totalTokens: cost.promptTokens + cost.completionTokens,
    costUsd: anyPriced ? cost.totalUsd : null,
    // A saving is only honest across fully priced traffic: mixing in models
    // with no rate would compare a partial bill with a partial counterfactual.
    withoutCachingUsd: priced ? cost.withoutCachingUsd : null,
    savedByCachingUsd: priced ? cost.savedByCachingUsd : null,
    cacheHitRate: cost.cacheHitRate,
    unpricedModels: cost.unpricedModels,
    pricingCheckedOn: PRICING_CHECKED_ON,
    purposes,
  };
}
