"use client";

import { useLibraryList } from "@/hooks/use-library-list";
import { useCallback } from "react";
import { readJson } from "@/lib/api/fetch-json";

export interface JobDescriptionSummary {
  id: string;
  title: string;
  roleTitle: string | null;
  company: string | null;
  sourceUrl: string | null;
  notes: string | null;
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
    company?: string | null;
    sourceUrl?: string | null;
  }) => Promise<JobDescriptionSummary | null>;
  uploadPdf: (input: {
    file: File;
    roleTitle?: string | null;
    company?: string | null;
    sourceUrl?: string | null;
  }) => Promise<JobDescriptionSummary | null>;
  /**
   * Metadata always; the text only when no interview using it is mid-way — the
   * chunks are read live on every turn, so re-embedding under a running session
   * would change its grounding halfway through. Rejects with the server's
   * message, which names the count.
   */
  update: (
    id: string,
    patch: {
      title?: string;
      roleTitle?: string | null;
      company?: string | null;
      sourceUrl?: string | null;
      notes?: string | null;
      rawText?: string;
    },
  ) => Promise<JobDescriptionSummary | null>;
  remove: (id: string) => Promise<boolean>;
  /**
   * How many sessions a delete would strip this JD from, for the confirm
   * dialog. Returns null if the count could not be fetched, which callers
   * should treat as "say nothing" rather than "say zero".
   */
  countUsage: (id: string) => Promise<JobDescriptionUsage | null>;
}

export interface JobDescriptionUsage {
  inProgress: number;
  completed: number;
}

export interface JobDescriptionFilters {
  query?: string;
}

/**
 * `limit=50` is explicit because omitting it silently took the route's fallback
 * of 20 while the cap is 50 — so a 21st saved item was unreachable from both
 * this page and the setup wizard's picker.
 *
 * Filters go to the server for the same reason: with the list capped, filtering
 * in the page would only ever search the 50 rows that happened to load.
 */
async function loadJobDescriptions(
  filters: JobDescriptionFilters = {},
): Promise<JobDescriptionSummary[]> {
  const params = new URLSearchParams({ limit: "50" });
  if (filters.query?.trim()) params.set("query", filters.query.trim());

  const response = await fetch(`/api/job-descriptions?${params}`, {
    cache: "no-store",
  });

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
      detail?.error ??
        `Failed to load job descriptions (HTTP ${response.status}).`,
    );
  }

  const payload = await readJson<ApiPayload>(response);
  return payload.jobDescriptions ?? [];
}

/**
 * Manages the user's job description library. Mirrors the persona library
 * hook so callers in the wizard can treat both consistently.
 */
export function useJobDescriptions(
  filters: JobDescriptionFilters = {},
): UseJobDescriptions {
  // Destructured into primitives so the loader identity tracks the filter
  // *values*, not the identity of an object literal a caller re-creates every
  // render. `useLibraryList` refetches whenever `load` changes, which is
  // exactly the behaviour wanted here — and callers that pass no filters get a
  // stable loader and the old behaviour untouched.
  const { query } = filters;
  const load = useCallback(() => loadJobDescriptions({ query }), [query]);

  const { items, status, error, refresh, setItems, setError } = useLibraryList(
    load,
    "Failed to load job descriptions.",
  );

  const uploadText = useCallback<UseJobDescriptions["uploadText"]>(
    async ({ rawText, roleTitle, company, sourceUrl }) => {
      try {
        const response = await fetch("/api/job-descriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawText,
            roleTitle: roleTitle ?? null,
            company: company ?? null,
            sourceUrl: sourceUrl ?? null,
          }),
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
    [setItems, setError],
  );

  const uploadPdf = useCallback<UseJobDescriptions["uploadPdf"]>(
    async ({ file, roleTitle, company, sourceUrl }) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (roleTitle?.trim()) formData.append("roleTitle", roleTitle.trim());
        if (company?.trim()) formData.append("company", company.trim());
        if (sourceUrl?.trim()) formData.append("sourceUrl", sourceUrl.trim());

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
        setError(err instanceof Error ? err.message : "Failed to upload PDF.");
        return null;
      }
    },
    [setItems, setError],
  );

  const update = useCallback<UseJobDescriptions["update"]>(
    async (id, patch) => {
      try {
        const response = await fetch(`/api/job-descriptions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const payload = await readJson<ApiPayload>(response);
        const jd = payload.jobDescription;
        if (!jd) throw new Error("Server returned no job description.");
        // Replaced in place rather than refetched: the row is already the
        // server's own copy, so a round trip would only re-sort the list under
        // the user for no new information.
        setItems((current) =>
          current.map((item) => (item.id === id ? jd : item)),
        );
        return jd;
      } catch (err) {
        // Rethrown rather than swallowed into the library-level error banner.
        // A refusal is about the dialog the user is standing in and needs to be
        // shown there, next to the field it refused — `readJson` has already
        // turned the 409 body into this message, count and all.
        throw err instanceof Error
          ? err
          : new Error("Failed to update job description.");
      }
    },
    // No `setError`: this one rethrows rather than writing the library-level
    // error, so the dialog can show the refusal beside the field it refused.
    [setItems],
  );

  const remove = useCallback<UseJobDescriptions["remove"]>(
    async (id) => {
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
    },
    [setItems, setError],
  );

  /**
   * Deliberately does not call `setError`.
   *
   * `error` here is the library-level one the page renders as a full
   * error card in place of the list. A failed count is not that: it is a
   * detail missing from a dialog the user opened, and blowing away the list
   * behind it would be a wildly disproportionate response. Returning null lets
   * the dialog fall back to its generic copy, which is still accurate — just
   * less specific.
   */
  const countUsage = useCallback<UseJobDescriptions["countUsage"]>(
    async (id) => {
      try {
        const response = await fetch(`/api/job-descriptions/${id}/usage`, {
          cache: "no-store",
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as Partial<JobDescriptionUsage>;
        if (
          typeof payload.inProgress !== "number" ||
          typeof payload.completed !== "number"
        ) {
          return null;
        }
        return { inProgress: payload.inProgress, completed: payload.completed };
      } catch {
        return null;
      }
    },
    [],
  );

  return {
    items,
    status,
    error,
    refresh,
    uploadText,
    uploadPdf,
    update,
    remove,
    countUsage,
  };
}
