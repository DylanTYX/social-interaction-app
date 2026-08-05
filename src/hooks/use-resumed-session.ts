"use client";

import { useMemo } from "react";

import type { AnalysisResult } from "@/lib/response-analyzer";
import type { InterviewBootstrap } from "@/hooks/use-interview-session-bootstrap";

/**
 * A session's restored transcript and scoring history, in the shape both
 * interview screens consume.
 *
 * This used to issue its own `GET /api/sessions/[id]/resume` request. The
 * bootstrap hook already calls that exact endpoint on the same render — it took
 * the launch config from the response and discarded the transcript — so every
 * interview load fetched the whole transcript and every turn analysis twice,
 * both with `cache: "no-store"` so nothing deduplicated them.
 *
 * That went unnoticed while resuming was rare. Once the session id went into
 * every interview URL, both requests started firing on every single load.
 *
 * So there is no fetch here any more: the data arrives with the bootstrap and
 * this only reshapes it. Restoring *only* the messages (which an earlier
 * version of this hook did) reset `analysisHistory` to empty, so the running
 * average regressed and the first post-resume turn clobbered the stored
 * dimension snapshots — hence analyses travel with the messages, not apart.
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

const EMPTY: ResumedMessage[] = [];
const NO_ANALYSES: AnalysisResult[] = [];

export function useResumedSession(
  bootstrap: InterviewBootstrap,
): ResumedSession {
  return useMemo(() => {
    if (bootstrap.status === "loading") {
      return { status: "loading", messages: EMPTY, analyses: NO_ANALYSES };
    }

    // A fresh launch has no transcript to restore. That is "ready with
    // nothing", not "idle" — the caller renders its welcome message and starts
    // the interview, and it must not sit waiting for data that is not coming.
    if (!bootstrap.resumed) {
      return { status: "ready", messages: EMPTY, analyses: NO_ANALYSES };
    }

    return {
      status: "ready",
      messages: bootstrap.resumed.messages,
      analyses: bootstrap.resumed.analyses,
    };
  }, [bootstrap.status, bootstrap.resumed]);
}
