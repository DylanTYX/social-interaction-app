"use client";

import { useLibraryList } from "@/hooks/use-library-list";
import { useCallback } from "react";
import { readJson } from "@/lib/api/fetch-json";

export interface ResumeSummary {
  id: string;
  title: string;
  /** "PM version", "IC/backend" — library-only, never sent to a prompt. */
  variant: string | null;
  /** The user's own note. Library-only, for the same reason. */
  notes: string | null;
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
    variant?: string | null;
  }) => Promise<ResumeSummary | null>;
  uploadPdf: (input: {
    file: File;
    title?: string | null;
    variant?: string | null;
  }) => Promise<ResumeSummary | null>;
  /**
   * Metadata always; the text only when no interview using it is mid-way — the
   * Resume is read live on every turn, so replacing it under a running session
   * would change what the candidate is being asked about halfway through.
   * Rejects with the server's message, which names the count.
   */
  update: (
    id: string,
    patch: {
      title?: string;
      variant?: string | null;
      notes?: string | null;
      rawText?: string;
    },
  ) => Promise<ResumeSummary | null>;
  remove: (id: string) => Promise<boolean>;
  /**
   * How many sessions a delete would strip this resume from, for the confirm
   * dialog. Returns null if the count could not be fetched, which callers
   * should treat as "say nothing" rather than "say zero".
   */
  countUsage: (id: string) => Promise<ResumeUsage | null>;
}

export interface ResumeUsage {
  inProgress: number;
  completed: number;
}

export interface ResumeFilters {
  query?: string;
}

/**
 * `limit=50` is explicit because omitting it silently took the route's fallback
 * of 20 while the cap is 50 — so a 21st saved item was unreachable from both
 * this page and the setup wizard's picker.
 */
async function loadResumes(
  filters: ResumeFilters = {},
): Promise<ResumeSummary[]> {
  const params = new URLSearchParams({ limit: "50" });
  if (filters.query?.trim()) params.set("query", filters.query.trim());

  const response = await fetch(`/api/resumes?${params}`, {
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
      detail?.error ?? `Failed to load resumes (HTTP ${response.status}).`,
    );
  }

  const payload = await readJson<ApiPayload>(response);
  return payload.resumes ?? [];
}

/** Manages the user's resume/resume library. Mirrors `useJobDescriptions`. */
export function useResumes(filters: ResumeFilters = {}): UseResumes {
  // Destructured into primitives so the loader identity tracks the filter
  // *values*, not the identity of an object literal a caller re-creates every
  // render. `useLibraryList` refetches whenever `load` changes, which is
  // exactly the behaviour wanted here — and callers that pass no filters get a
  // stable loader and the old behaviour untouched.
  const { query } = filters;
  const load = useCallback(() => loadResumes({ query }), [query]);

  const { items, status, error, refresh, setItems, setError } = useLibraryList(
    load,
    "Failed to load resumes.",
  );

  const uploadText = useCallback<UseResumes["uploadText"]>(
    async ({ rawText, title, variant }) => {
      try {
        // Explicit, because omitting it silently took the route's fallback of 20
        // while the cap is 50 — so a 21st saved item was unreachable from both
        // this page and the setup wizard's picker.
        const response = await fetch("/api/resumes?limit=50", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawText,
            title: title ?? null,
            variant: variant ?? null,
          }),
        });
        const payload = await readJson<ApiPayload>(response);
        const resume = payload.resume;
        if (!resume) throw new Error("Server returned no resume.");
        // Clear whatever a previous failure left behind. Only `refresh` used to
        // do this, so a save that succeeded on the second try still rendered
        // the first try's red message underneath it.
        setError(null);
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
    async ({ file, title, variant }) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (title && title.trim()) {
          formData.append("title", title.trim());
        }
        if (variant && variant.trim()) {
          formData.append("variant", variant.trim());
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
        // Same as above: a retry that works should not leave the failed
        // attempt's message on screen.
        setError(null);
        setItems((current) => [resume, ...current]);
        return resume;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload PDF.");
        return null;
      }
    },
    [setItems, setError],
  );

  const update = useCallback<UseResumes["update"]>(
    async (id, patch) => {
      try {
        const response = await fetch(`/api/resumes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const payload = await readJson<ApiPayload>(response);
        const resume = payload.resume;
        if (!resume) throw new Error("Server returned no resume.");
        // Replaced in place rather than refetched: the row is already the
        // server's own copy, so a round trip would only re-sort the list under
        // the user for no new information.
        setItems((current) =>
          current.map((item) => (item.id === id ? resume : item)),
        );
        return resume;
      } catch (err) {
        // Rethrown rather than swallowed into the library-level error banner.
        // A refusal is about the dialog the user is standing in and needs to be
        // shown there, next to the field it refused — `readJson` has already
        // turned the 409 body into this message, count and all.
        throw err instanceof Error
          ? err
          : new Error("Failed to update resume.");
      }
    },
    // No `setError`: this one rethrows rather than writing the library-level
    // error, so the dialog can show the refusal beside the field it refused.
    [setItems],
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

  /**
   * Deliberately does not call `setError`.
   *
   * `error` here is the library-level one the page renders as a full error card
   * in place of the list. A failed count is not that: it is a detail missing
   * from a dialog the user opened, and blowing away the list behind it would be
   * a wildly disproportionate response. Returning null lets the dialog fall
   * back to its generic copy, which is still accurate — just less specific.
   */
  const countUsage = useCallback<UseResumes["countUsage"]>(async (id) => {
    try {
      const response = await fetch(`/api/resumes/${id}/usage`, {
        cache: "no-store",
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as Partial<ResumeUsage>;
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
  }, []);

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
