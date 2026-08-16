"use client";

import { useLibraryList } from "@/hooks/use-library-list";
import { useCallback } from "react";
import { readJson } from "@/lib/api/fetch-json";

export interface ResumeSummary {
  id: string;
  title: string;
  sourceType: "text";
  rawText: string;
  /** Original length when the upload was shortened; null when stored whole. */
  truncatedFrom: number | null;
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

/**
 * `limit=50` is explicit because omitting it silently took the route's fallback
 * of 20 while the cap is 50 — so a 21st saved item was unreachable from both
 * this page and the setup wizard's picker.
 */
async function loadResumes(): Promise<ResumeSummary[]> {
  const response = await fetch("/api/resumes?limit=50", { cache: "no-store" });

  if (!response.ok) {
    // A 401 is an error, not an empty library. Swallowing it made a signed-out
    // user see the cheerful "add your first one" empty state.
    if (response.status === 401) {
      throw new Error("Your session expired. Sign in again to continue.");
    }
    const detail = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      detail?.error ?? `Failed to load resumes (HTTP ${response.status}).`,
    );
  }

  const payload = await readJson<ApiPayload>(response);
  return payload.resumes ?? [];
}

/** Manages the user's resume/CV library. Mirrors `useJobDescriptions`. */
export function useResumes(): UseResumes {
  const { items, status, error, refresh, setItems, setError } = useLibraryList(
    loadResumes,
    "Failed to load resumes.",
  );

  const uploadText = useCallback<UseResumes["uploadText"]>(
    async ({ rawText, title }) => {
      try {
        // Explicit, because omitting it silently took the route's fallback of 20
        // while the cap is 50 — so a 21st saved item was unreachable from both
        // this page and the setup wizard's picker.
        const response = await fetch("/api/resumes?limit=50", {
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
    [setItems, setError],
  );

  const uploadPdf = useCallback<UseResumes["uploadPdf"]>(
    async ({ file, title }) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (title && title.trim()) {
          formData.append("title", title.trim());
        }

        // Explicit, because omitting it silently took the route's fallback of 20
        // while the cap is 50 — so a 21st saved item was unreachable from both
        // this page and the setup wizard's picker.
        const response = await fetch("/api/resumes?limit=50", {
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
    [setItems, setError],
  );

  const remove = useCallback<UseResumes["remove"]>(
    async (id) => {
      try {
        const response = await fetch(`/api/resumes/${id}`, {
          method: "DELETE",
        });
        await readJson<ApiPayload>(response);
        setItems((current) => current.filter((item) => item.id !== id));
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete resume.",
        );
        return false;
      }
    },
    [setItems, setError],
  );

  return { items, status, error, refresh, uploadText, uploadPdf, remove };
}
