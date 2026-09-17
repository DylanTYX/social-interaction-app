"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useTokenUsage, type UsageWindow } from "@/hooks/use-token-usage";
import { formatTokens, formatUsd } from "@/lib/format";

const WINDOWS: { value: UsageWindow; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

/**
 * What your practice has cost to run, in tokens and in money.
 *
 * Every model call has been recorded since the app was built — the interviewer,
 * the scorer, the coach, the summary and the document reads — but only a
 * developer command could read it back. This is that accounting shown to the
 * person who caused it.
 *
 * The rate card stays on the server: `/api/me/usage` prices the caller's own
 * rows and sends totals, so nothing here knows what a token costs. The dollar
 * figure says which rates produced it and when they were checked, because a
 * price table is exactly the kind of constant that goes stale quietly.
 */
export function TokenUsageCard() {
  const [usageWindow, setUsageWindow] = useState<UsageWindow>("30d");
  const { usage, status, error, refresh } = useTokenUsage({
    window: usageWindow,
  });

  const picker = (
    <Select
      value={usageWindow}
      onValueChange={(next) => setUsageWindow(next as UsageWindow)}
    >
      <SelectTrigger size="sm" className="w-40" aria-label="Usage period">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WINDOWS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (status === "error") {
    return (
      <ErrorStateCard
        title="Couldn't load your usage"
        description={error ?? "Something went wrong."}
        onRetry={() => void refresh()}
      />
    );
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className={PANEL_LABEL}>Tokens used</p>
          {status === "loading" ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-1 font-display text-3xl leading-none font-bold tracking-tight text-navy tabular-nums">
              {formatTokens(usage?.totalTokens ?? 0)}
            </p>
          )}
          {status === "ready" && (
            <p className="mt-1.5 text-sm text-slate-500">
              {usage?.costUsd === null || usage === null
                ? "No cost to show yet"
                : `About ${formatUsd(usage.costUsd)} at list prices`}
            </p>
          )}
        </div>
        {picker}
      </div>

      {status === "loading" ? (
        <div className="space-y-3 px-5 py-4">
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
        </div>
      ) : !usage || usage.calls === 0 ? (
        <div className="px-5 py-4">
          <EmptyStateCard
            title="Nothing used in this period"
            description="Tokens are counted when you practise: each question asked, each answer scored, each document read."
          />
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1fr)_5rem_6rem_6rem] gap-4 border-b border-slate-100 px-5 py-2 sm:grid">
            <p className={PANEL_LABEL}>What the tokens bought</p>
            <p className={`${PANEL_LABEL} text-right`}>Calls</p>
            <p className={`${PANEL_LABEL} text-right`}>Tokens</p>
            <p className={`${PANEL_LABEL} text-right`}>Cost</p>
          </div>
          <dl className="divide-y divide-slate-100">
            {usage.purposes.map((purpose) => (
              <div
                key={purpose.callSite}
                className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_5rem_6rem_6rem]"
              >
                <dt className="font-medium text-slate-900">{purpose.label}</dt>
                <dd className="text-right text-slate-500 tabular-nums">
                  <span className="sr-only">Calls: </span>
                  {purpose.calls.toLocaleString()}
                </dd>
                <dd className="text-right text-slate-700 tabular-nums">
                  <span className="sr-only">Tokens: </span>
                  {formatTokens(purpose.totalTokens)}
                </dd>
                <dd className="text-right text-slate-700 tabular-nums">
                  <span className="sr-only">Cost: </span>
                  {purpose.costUsd === null ? "—" : formatUsd(purpose.costUsd)}
                </dd>
              </div>
            ))}
          </dl>

          <div className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-xs leading-5 text-slate-500">
            {usage.savedByCachingUsd !== null &&
              usage.savedByCachingUsd > 0 && (
                <p>
                  Reusing the unchanged part of each prompt saved{" "}
                  {formatUsd(usage.savedByCachingUsd)} of this.
                </p>
              )}
            <p>
              An estimate, from published prices checked on{" "}
              {usage.pricingCheckedOn}. It counts only your own practice.
            </p>
            {usage.unpricedModels.length > 0 && (
              <p>
                No published price here for {usage.unpricedModels.join(", ")},
                so those calls are counted in the tokens but not in the cost.
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
