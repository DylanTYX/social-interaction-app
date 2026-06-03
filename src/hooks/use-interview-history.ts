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

export interface UseInterviewHistory {
  sessions: InterviewSessionSummary[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads the user's interview sessions from `/api/sessions`. Replaces the
 * previous localStorage-only history.
 */
export function useInterviewHistory(limit = 25): UseInterviewHistory {
  const [sessions, setSessions] = useState<InterviewSessionSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch(`/api/sessions?limit=${limit}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 401) {
          setSessions([]);
          setStatus("ready");
          return;
        }
        const detail = (await response
          .json()
          .catch(() => null)) as { error?: string } | null;
        throw new Error(
          detail?.error ?? `Failed to load sessions (HTTP ${response.status}).`,
        );
      }
      const { sessions: list } = (await response.json()) as {
        sessions: InterviewSessionSummary[];
      };
      setSessions(list);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
      setStatus("error");
    }
  }, [limit]);

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

  return { sessions, status, error, refresh };
}
