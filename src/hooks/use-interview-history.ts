"use client";

import { useCallback, useEffect, useState } from "react";

export interface InterviewSessionSummary {
  id: string;
  practiceMode: "text" | "voice";
  scenarioTitle: string | null;
  scenarioValue: string;
  personaName: string;
  status: "in_progress" | "completed" | "abandoned";
  averageScore: number | null;
  durationMinutes: number | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  metrics?: Record<string, unknown> | null;
}

export interface InterviewHistoryFilters {
  /** Free text, matched server-side against scenario title and persona name. */
  query?: string;
  mode?: "text" | "voice";
  status?: InterviewSessionSummary["status"];
}

export interface UseInterviewHistory {
  sessions: InterviewSessionSummary[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  /** Append the next page. No-op while one is in flight or when exhausted. */
  loadMore: () => Promise<void>;
  /** Rows matching the current filters, ignoring paging. */
  total: number;
  hasMore: boolean;
  /** True only while appending, so a list can stay on screen during it. */
  loadingMore: boolean;
}

/**
 * The user's interview sessions.
 *
 * Filters are passed to the server rather than applied to the result, because
 * filtering what had already been fetched meant search answered "not in the
 * first 50" while appearing to answer "you don't have one".
 *
 * The filter argument is optional and defaults to nothing, so the two callers
 * that only want recent sessions for statistics — the dashboard home and the
 * analytics page — behave exactly as before.
 */
export function useInterviewHistory(
  limit = 25,
  filters: InterviewHistoryFilters = {},
): UseInterviewHistory {
  const [sessions, setSessions] = useState<InterviewSessionSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  // Separate from `status` on purpose: flipping the whole hook to "loading"
  // while appending would blank the list the user is reading.
  const [loadingMore, setLoadingMore] = useState(false);

  // Destructured so the callbacks depend on the values, not on an object
  // identity that changes every render.
  const { query, mode, status: statusFilter } = filters;

  const buildUrl = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (offset > 0) params.set("offset", String(offset));
      if (query?.trim()) params.set("q", query.trim());
      if (mode) params.set("mode", mode);
      if (statusFilter) params.set("status", statusFilter);
      return `/api/sessions?${params.toString()}`;
    },
    [limit, query, mode, statusFilter],
  );

  const fetchPage = useCallback(
    async (offset: number) => {
      const response = await fetch(buildUrl(offset), { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401) return null;
        const detail = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          detail?.error ?? `Failed to load sessions (HTTP ${response.status}).`,
        );
      }
      return (await response.json()) as {
        sessions: InterviewSessionSummary[];
        total?: number;
      };
    },
    [buildUrl],
  );

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const payload = await fetchPage(0);
      if (payload === null) {
        setSessions([]);
        setTotal(0);
        setStatus("ready");
        return;
      }
      setSessions(payload.sessions);
      setTotal(payload.total ?? payload.sessions.length);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
      setStatus("error");
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const payload = await fetchPage(sessions.length);
      if (payload === null) return;
      // Guard against a double-append if two clicks race: the server is the
      // source of truth for order, so dedupe by id rather than trusting length.
      setSessions((current) => {
        const seen = new Set(current.map((entry) => entry.id));
        return [
          ...current,
          ...payload.sessions.filter((entry) => !seen.has(entry.id)),
        ];
      });
      setTotal(payload.total ?? sessions.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore, sessions.length]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return {
    sessions,
    status,
    error,
    refresh,
    loadMore,
    total,
    hasMore: sessions.length < total,
    loadingMore,
  };
}
