"use client";

import { useCallback, useEffect, useState } from "react";
import { readJson } from "@/lib/api/fetch-json";

export interface JobDescriptionSummary {
  id: string;
  title: string;
  roleTitle: string | null;
  sourceType: "text";
  rawText: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiPayload {
  jobDescriptions?: JobDescriptionSummary[];
  jobDescription?: JobDescriptionSummary;
  error?: string;
}

export interface UseJobDescriptions {
  items: JobDescriptionSummary[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  uploadText: (input: {
    rawText: string;
    roleTitle?: string | null;
  }) => Promise<JobDescriptionSummary | null>;
  uploadPdf: (input: {
    file: File;
    roleTitle?: string | null;
  }) => Promise<JobDescriptionSummary | null>;
  remove: (id: string) => Promise<boolean>;
}

/**
 * Manages the user's job description library. Mirrors the persona library
 * hook so callers in the wizard can treat both consistently.
 */
export function useJobDescriptions(): UseJobDescriptions {
  const [items, setItems] = useState<JobDescriptionSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      // Explicit, because omitting it silently took the route's fallback of 20
      // while the cap is 50 — so a 21st saved item was unreachable from both
      // this page and the setup wizard's picker.
      const response = await fetch("/api/job-descriptions?limit=50", {
        cache: "no-store",
      });
      if (!response.ok) {
        // A 401 is an error, not an empty library. Swallowing it here made a
        // signed-out user see the cheerful "add your first one" empty state —
        // and made three sibling pages behave three different ways, since
        // `usePersonaLibrary` has always surfaced it. One policy now.
        if (response.status === 401) {
          throw new Error("Your session expired. Sign in again to continue.");
        }
        const detail = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          detail?.error ??
            `Failed to load job descriptions (HTTP ${response.status}).`,
        );
      }
      const payload = await readJson<ApiPayload>(response);
      setItems(payload.jobDescriptions ?? []);
      setStatus("ready");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load job descriptions.",
      );
      setStatus("error");
    }
  }, []);

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

  const uploadText = useCallback<UseJobDescriptions["uploadText"]>(
    async ({ rawText, roleTitle }) => {
      try {
        // Explicit, because omitting it silently took the route's fallback of 20
        // while the cap is 50 — so a 21st saved item was unreachable from both
        // this page and the setup wizard's picker.
        const response = await fetch("/api/job-descriptions?limit=50", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, roleTitle: roleTitle ?? null }),
        });
        const payload = await readJson<ApiPayload>(response);
        const jd = payload.jobDescription;
        if (!jd) throw new Error("Server returned no job description.");
        setItems((current) => [jd, ...current]);
        return jd;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to save job description.",
        );
        return null;
      }
    },
    [],
  );

  const uploadPdf = useCallback<UseJobDescriptions["uploadPdf"]>(
    async ({ file, roleTitle }) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (roleTitle && roleTitle.trim()) {
          formData.append("roleTitle", roleTitle.trim());
        }

        // Explicit, because omitting it silently took the route's fallback of 20
        // while the cap is 50 — so a 21st saved item was unreachable from both
        // this page and the setup wizard's picker.
        const response = await fetch("/api/job-descriptions?limit=50", {
          method: "POST",
          body: formData,
        });
        const payload = await readJson<ApiPayload>(response);
        const jd = payload.jobDescription;
        if (!jd) throw new Error("Server returned no job description.");
        setItems((current) => [jd, ...current]);
        return jd;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload PDF.");
        return null;
      }
    },
    [],
  );

  const remove = useCallback<UseJobDescriptions["remove"]>(async (id) => {
    try {
      const response = await fetch(`/api/job-descriptions/${id}`, {
        method: "DELETE",
      });
      await readJson<ApiPayload>(response);
      setItems((current) => current.filter((item) => item.id !== id));
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete job description.",
      );
      return false;
    }
  }, []);

  return {
    items,
    status,
    error,
    refresh,
    uploadText,
    uploadPdf,
    remove,
  };
}
