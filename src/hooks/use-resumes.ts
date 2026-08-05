"use client";

import { useCallback, useEffect, useState } from "react";
import { readJson } from "@/lib/api/fetch-json";

export interface ResumeSummary {
  id: string;
  title: string;
  sourceType: "text";
  rawText: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiPayload {
  resumes?: ResumeSummary[];
  resume?: ResumeSummary;
  error?: string;
}

export interface UseResumes {
  items: ResumeSummary[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  uploadText: (input: {
    rawText: string;
    title?: string | null;
  }) => Promise<ResumeSummary | null>;
  uploadPdf: (input: {
    file: File;
    title?: string | null;
  }) => Promise<ResumeSummary | null>;
  remove: (id: string) => Promise<boolean>;
}

/** Manages the user's resume/CV library. Mirrors `useJobDescriptions`. */
export function useResumes(): UseResumes {
  const [items, setItems] = useState<ResumeSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/resumes", { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401) {
          setItems([]);
          setStatus("ready");
          return;
        }
        const detail = (await response
          .json()
          .catch(() => null)) as { error?: string } | null;
        throw new Error(
          detail?.error ?? `Failed to load resumes (HTTP ${response.status}).`,
        );
      }
      const payload = await readJson<ApiPayload>(response);
      setItems(payload.resumes ?? []);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resumes.");
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

  const uploadText = useCallback<UseResumes["uploadText"]>(
    async ({ rawText, title }) => {
      try {
        const response = await fetch("/api/resumes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, title: title ?? null }),
        });
        const payload = await readJson<ApiPayload>(response);
        const resume = payload.resume;
        if (!resume) throw new Error("Server returned no resume.");
        setItems((current) => [resume, ...current]);
        return resume;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save resume.");
        return null;
      }
    },
    [],
  );

  const uploadPdf = useCallback<UseResumes["uploadPdf"]>(
    async ({ file, title }) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (title && title.trim()) {
          formData.append("title", title.trim());
        }

        const response = await fetch("/api/resumes", {
          method: "POST",
          body: formData,
        });
        const payload = await readJson<ApiPayload>(response);
        const resume = payload.resume;
        if (!resume) throw new Error("Server returned no resume.");
        setItems((current) => [resume, ...current]);
        return resume;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload PDF.");
        return null;
      }
    },
    [],
  );

  const remove = useCallback<UseResumes["remove"]>(async (id) => {
    try {
      const response = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      await readJson<ApiPayload>(response);
      setItems((current) => current.filter((item) => item.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resume.");
      return false;
    }
  }, []);

  return { items, status, error, refresh, uploadText, uploadPdf, remove };
}
