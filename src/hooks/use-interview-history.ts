"use client";

import { readJson } from "@/lib/api/fetch-json";
import { useCallback, useRef, useEffect, useState } from "react";

export interface InterviewSessionSummary {
  id: string;
  practiceMode: "text" | "voice";
  scenarioTitle: string | null;
  scenarioValue: string;
  personaName: string;
  status: "in_progress" | "completed" | "abandoned";
  /**
   * Messages exchanged, not answers given — `append_interview_turn` bumps it by
   * two per user/assistant pair, plus one for the opening greeting. Used to
   * decide whether a session is substantial enough to score.
   */
  turnCount: number;
  /**
   * Answers that produced a score. Lower than `turnCount` whenever the analyzer
   * skipped something — a one-word reply, or the timer's no-response
   * placeholder — which is why the stats gate on this rather than on messages.
   * Absent on payloads written before it existed.
   */
  scoredTurnCount?: number | null;
  averageScore: number | null;
  durationMinutes: number | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  metrics?: Record<string, unknown> | null;
  /**
   * Which competencies this session's questions touched. Already stored and
   * already returned by the API; declared here so the analytics page can ask
   * the cross-session question the per-session report cannot.
   */
  competencyCoverage?: unknown;
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
      // Signed out is not an error here — the caller renders an empty history
      // rather than a failure. Every other status goes through `readJson`,
      // which surfaces the server's own message.
      if (response.status === 401) return null;
      return await readJson<{
        sessions: InterviewSessionSummary[];
        total?: number;
      }>(response);
    },
    [buildUrl],
  );

  /**
   * Which refresh is allowed to write. Anything older is a stale response.
   *
   * `refresh` is rebuilt whenever `limit`, `query`, `mode` or `statusFilter`
   * change, and the sessions page changes them from a debounced search box and
   * two selects — so two requests are routinely in flight. There was no guard
   * at all: whichever resolved *last* won, so a slow first request could land
   * after a fast second one and leave the list showing results for a filter the
   * controls no longer displayed, with nothing to correct it until the next
   * refetch.
   */
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestIdRef.current === requestId;

    setStatus("loading");
    setError(null);
    try {
      const payload = await fetchPage(0);
      if (!isCurrent()) return;

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
      if (!isCurrent()) return;
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
