"use client";

import { useCallback, useEffect, useState } from "react";

import { listTagsRequest } from "@/lib/session-actions";

/** Every tag the user has used, most used first. */
export function useSessionTags() {
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([]);

  const refresh = useCallback(async () => {
    try {
      setTags(await listTagsRequest());
    } catch {
      // Suggestions and a filter list are conveniences; an empty list is fine.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { tags, refresh };
}
