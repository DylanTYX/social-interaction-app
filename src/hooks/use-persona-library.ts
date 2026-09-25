"use client";

import { useLibraryList } from "@/hooks/use-library-list";
import { useCallback } from "react";
import {
  createPersonaEntry,
  deletePersonaEntry,
  duplicatePersonaEntry,
  fetchPersonaLibrary,
  resetPersonaLibrary,
  updatePersonaEntry,
  type PersonaLibraryEntry,
} from "@/lib/persona-library";
import type { PersonaConfig } from "@/lib/persona-engine";
import { GENERIC_ERROR_MESSAGE, toUserMessage } from "@/lib/user-facing-error";

export interface UsePersonaLibrary {
  library: PersonaLibraryEntry[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  createEntry: (config: PersonaConfig) => Promise<PersonaLibraryEntry | null>;
  updateEntry: (
    id: string,
    config: PersonaConfig,
  ) => Promise<PersonaLibraryEntry | null>;
  duplicateEntry: (
    entry: PersonaLibraryEntry,
  ) => Promise<PersonaLibraryEntry | null>;
  deleteEntry: (id: string) => Promise<boolean>;
  resetLibrary: () => Promise<void>;
}

/**
 * Manages the user's persona library state in the browser. Optimistically
 * surfaces errors via the `error` field so callers can render a toast/banner;
 * library state is always re-derived from server responses (no local cache
 * drift).
 */
export function usePersonaLibrary(): UsePersonaLibrary {
  const {
    items: library,
    status,
    error,
    refresh,
    setItems: setLibrary,
    setError,
  } = useLibraryList(fetchPersonaLibrary, GENERIC_ERROR_MESSAGE);

  const createEntry = useCallback(
    async (config: PersonaConfig) => {
      try {
        const created = await createPersonaEntry({ config, kind: "user" });
        setLibrary((current) => [created, ...current]);
        return created;
      } catch (err) {
        setError(
          toUserMessage(err, "Couldn't save the persona. Try again."),
        );
        return null;
      }
    },
    [setLibrary, setError],
  );

  const updateEntry = useCallback(
    async (id: string, config: PersonaConfig) => {
      try {
        const updated = await updatePersonaEntry(id, config);
        setLibrary((current) =>
          current.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
        return updated;
      } catch (err) {
        setError(
          toUserMessage(err, "Couldn't update the persona. Try again."),
        );
        return null;
      }
    },
    [setLibrary, setError],
  );

  const duplicateEntry = useCallback(
    async (entry: PersonaLibraryEntry) => {
      try {
        const copy = await duplicatePersonaEntry(entry);
        setLibrary((current) => [copy, ...current]);
        return copy;
      } catch (err) {
        setError(
          toUserMessage(err, "Couldn't duplicate the persona. Try again."),
        );
        return null;
      }
    },
    [setLibrary, setError],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      try {
        await deletePersonaEntry(id);
        setLibrary((current) => current.filter((entry) => entry.id !== id));
        return true;
      } catch (err) {
        setError(
          toUserMessage(err, "Couldn't delete the persona. Try again."),
        );
        return false;
      }
    },
    [setLibrary, setError],
  );

  const resetLibrary_ = useCallback(async () => {
    try {
      const next = await resetPersonaLibrary();
      setLibrary(next);
    } catch (err) {
      setError(
        toUserMessage(err, "Couldn't restore the presets. Try again."),
      );
    }
  }, [setLibrary, setError]);

  return {
    library,
    status,
    error,
    refresh,
    createEntry,
    updateEntry,
    duplicateEntry,
    deleteEntry,
    resetLibrary: resetLibrary_,
  };
}
