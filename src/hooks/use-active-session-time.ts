"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  ACTIVITY_FLUSH_INTERVAL_MS,
  createActiveTimeTracker,
  type ActiveTimeTracker,
} from "@/lib/active-time";

/** Reports sent back to back in one flush, when several minutes are owed. */
const MAX_REPORTS_PER_FLUSH = 5;

/**
 * Adds up the time this session page is open and on screen, and reports it.
 *
 * Counting stops when the tab is hidden, the page is left or closed, or the
 * interview ends (`running` false). What was counted is sent every half
 * minute, and immediately on hide or close with `keepalive`, so closing the
 * tab mid-answer does not lose the minutes before it.
 *
 * The server adds each report to `active_seconds` and turns the total into the
 * session's duration when it completes, so the returned `flush` must be awaited
 * before the completion write — otherwise the last half minute arrives after
 * the session has stopped accepting time.
 *
 * Counts a page left open on screen while you are away from the desk, which
 * nothing in a browser can tell apart from reading a long question.
 */
export function useActiveSessionTime(
  sessionId: string | null,
  running: boolean,
): () => Promise<void> {
  const trackerRef = useRef<ActiveTimeTracker | null>(null);
  // Reports go one after another, so two flushes cannot send the same seconds
  // or land out of order.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const send = useCallback((id: string, keepalive: boolean) => {
    const next = queueRef.current.then(async () => {
      const tracker = trackerRef.current;
      if (!tracker) return;
      for (let i = 0; i < MAX_REPORTS_PER_FLUSH; i += 1) {
        const seconds = tracker.take(Date.now());
        if (seconds <= 0) return;
        try {
          const response = await fetch(
            `/api/sessions/${encodeURIComponent(id)}/activity`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ seconds }),
              keepalive,
            },
          );
          if (!response.ok) throw new Error(`activity ${response.status}`);
        } catch {
          // Best-effort, like every other mirror write during an interview:
          // keep the seconds for the next report and never interrupt the turn.
          tracker.restore(seconds);
          return;
        }
      }
    });
    queueRef.current = next;
    return next;
  }, []);

  useEffect(() => {
    if (!sessionId || !running) return;
    const tracker = (trackerRef.current ??= createActiveTimeTracker());
    const onScreen = () => document.visibilityState === "visible";

    tracker.setCounting(onScreen(), Date.now());

    const handleVisibility = () => {
      tracker.setCounting(onScreen(), Date.now());
      if (!onScreen()) void send(sessionId, true);
    };
    const handlePageHide = () => {
      tracker.setCounting(false, Date.now());
      void send(sessionId, true);
    };
    const interval = window.setInterval(() => {
      void send(sessionId, false);
    }, ACTIVITY_FLUSH_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      tracker.setCounting(false, Date.now());
      void send(sessionId, true);
    };
  }, [sessionId, running, send]);

  return useCallback(
    () => (sessionId ? send(sessionId, false) : Promise.resolve()),
    [sessionId, send],
  );
}
