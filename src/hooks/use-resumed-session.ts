"use client";

import { useEffect, useState } from "react";

import type { AnalysisResult } from "@/lib/responseAnalyzer";

/**
 * Restores a session's transcript and scoring history from the server.
 *
 * Both interview screens had their own copy of this effect, and both restored
 * *only* the messages. That silently reset `analysisHistory` to empty, so the
 * running average regressed to whatever was scored after the resume, and the
 * first post-resume turn overwrote the stored `dimensionSnapshots` array with a
 * single element (session metrics merge shallowly).
 */

export interface ResumedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ResumedSession {
  status: "idle" | "loading" | "ready";
  messages: ResumedMessage[];
  analyses: AnalysisResult[];
}

interface ResumePayload {
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
  turnAnalyses?: Array<{ analysis: unknown }>;
}

export function useResumedSession(sessionId: string | null): ResumedSession {
  const [state, setState] = useState<ResumedSession>({
    status: sessionId ? "loading" : "idle",
    messages: [],
    analyses: [],
  });

  useEffect(() => {
    if (!sessionId) {
      setState({ status: "idle", messages: [], analyses: [] });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/resume`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Could not resume this session.");

        const payload = (await response.json()) as ResumePayload;
        if (cancelled) return;

        setState({
          status: "ready",
          messages: (payload.messages ?? []).map((row) => ({
            id: row.id,
            role: row.role === "user" ? "user" : "assistant",
            content: row.content,
            createdAt: row.createdAt,
          })),
          // Pre-0006 sessions have no stored analyses; an empty history is the
          // correct outcome there, not an error.
          analyses: (payload.turnAnalyses ?? [])
            .map((row) => row.analysis as AnalysisResult)
            .filter((analysis): analysis is AnalysisResult => Boolean(analysis)),
        });
      } catch {
        // A failed resume falls back to a fresh transcript rather than
        // blocking the screen — the caller renders its welcome message.
        if (!cancelled) {
          setState({ status: "ready", messages: [], analyses: [] });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return state;
}
