"use client";

import { useCallback, useEffect, useState } from "react";

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

async function readJson<T extends ApiPayload>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status}).`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed?.error) message = parsed.error;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return JSON.parse(text) as T;
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
      const response = await fetch("/api/job-descriptions", {
        cache: "no-store",
      });
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
        const response = await fetch("/api/job-descriptions", {
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

        const response = await fetch("/api/job-descriptions", {
          method: "POST",
          body: formData,
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
            : "Failed to upload PDF.",
        );
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
        err instanceof Error ? err.message : "Failed to delete job description.",
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
