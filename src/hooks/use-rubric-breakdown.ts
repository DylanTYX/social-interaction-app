"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { readJson } from "@/lib/api/fetch-json";
import type { RoundBreakdown } from "@/lib/progress-insights";
import { GENERIC_ERROR_MESSAGE, toUserMessage } from "@/lib/user-facing-error";

export interface UseRubricBreakdown {
  rounds: RoundBreakdown[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * The user's recent answers summarised by round type, from
 * `/api/analytics/rubric`. Loaded separately from the session list because it
 * is a heavier read, so the rest of the analytics page does not wait on it.
 */
export function useRubricBreakdown(): UseRubricBreakdown {
  const [rounds, setRounds] = useState<RoundBreakdown[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/analytics/rubric", {
        cache: "no-store",
      });
      const payload = await readJson<{ rounds: RoundBreakdown[] }>(response);
      if (requestId !== requestIdRef.current) return;
      setRounds(payload.rounds ?? []);
      setStatus("ready");
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(
        toUserMessage(err, GENERIC_ERROR_MESSAGE),
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // Loading state is set inside `refresh`; the fetch is the side effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { rounds, status, error, refresh };
}
