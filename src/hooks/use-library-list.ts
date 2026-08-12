"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The list half of a document-library hook.
 *
 * `useResumes`, `useJobDescriptions` and `usePersonaLibrary` are the same hook
 * three times: `{items, status, error, refresh}`, seeded by a `queueMicrotask`
 * bootstrap, with per-resource mutations bolted on. Only the mutations differ,
 * so only the mutations stay in each file.
 *
 * Extracting it also fixes something none of the three did individually. Each
 * checked a `cancelled` flag *before* starting the request and never after it
 * resolved, so an in-flight load still wrote state after unmount, and two
 * overlapping refreshes resolved in whatever order they liked. The request
 * counter here settles both.
 */
export interface LibraryList<T> {
  items: T[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  /** For mutations that can update the list without a round trip. */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  setError: (message: string | null) => void;
}

export function useLibraryList<T>(
  /**
   * Must be referentially stable — module scope, or wrapped in `useCallback` by
   * the caller. An inline arrow re-arms the bootstrap effect on every render.
   */
  load: () => Promise<T[]>,
  fallbackMessage: string,
): LibraryList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  /** Only the newest request may write. Anything older is a stale response. */
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestIdRef.current === requestId;

    setStatus("loading");
    setError(null);
    try {
      const next = await load();
      if (!isCurrent()) return;
      setItems(next);
      setStatus("ready");
    } catch (err) {
      if (!isCurrent()) return;
      setError(err instanceof Error ? err.message : fallbackMessage);
      setStatus("error");
    }
  }, [load, fallbackMessage]);

  useEffect(() => {
    let cancelled = false;
    // On a microtask so the effect body itself performs no synchronous work.
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
      // Anything still in flight is now stale and must not write.
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { items, status, error, refresh, setItems, setError };
}
