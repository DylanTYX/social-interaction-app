"use client";

import { useCallback, useEffect, useState } from "react";

import { readJson } from "@/lib/api/fetch-json";

/**
 * The caller's own token usage, as `/api/me/usage` reports it.
 *
 * The response shape is declared here rather than imported from
 * `lib/usage-summary`, on purpose: that module reads the price table, and a
 * lint rule keeps both off every page and component so the rates cannot reach
 * a browser bundle. What crosses the wire is finished figures, and this is
 * their type.
 */

export type UsageWindow = "7d" | "30d" | "all";

export interface UsagePurposeView {
  callSite: string;
  label: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

export interface UsageSummaryView {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  costUsd: number | null;
  withoutCachingUsd: number | null;
  savedByCachingUsd: number | null;
  cacheHitRate: number;
  unpricedModels: string[];
  pricingCheckedOn: string;
  purposes: UsagePurposeView[];
}

export interface UseTokenUsage {
  usage: UsageSummaryView | null;
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTokenUsage({
  window: usageWindow = "30d",
  sessionId,
  enabled = true,
}: {
  window?: UsageWindow;
  /** One session's whole usage, however old it is. Ignores the window. */
  sessionId?: string | null;
  enabled?: boolean;
} = {}): UseTokenUsage {
  const [usage, setUsage] = useState<UsageSummaryView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setStatus((current) => (current === "ready" ? "loading" : current));
    const params = new URLSearchParams();
    if (sessionId) params.set("session", sessionId);
    else params.set("window", usageWindow);

    try {
      const response = await fetch(`/api/me/usage?${params.toString()}`, {
        cache: "no-store",
      });
      // Signed out is not an error here: the caller renders nothing.
      if (response.status === 401) {
        setUsage(null);
        setStatus("ready");
        return;
      }
      const payload = await readJson<{ usage: UsageSummaryView }>(response);
      setUsage(payload.usage);
      setStatus("ready");
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't load your usage.",
      );
      setStatus("error");
    }
  }, [enabled, sessionId, usageWindow]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // On a microtask so the effect body itself performs no synchronous work,
    // the way the library hooks seed their first load.
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, refresh]);

  return { usage, status, error, refresh };
}
