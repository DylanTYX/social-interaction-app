"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createFolderRequest,
  deleteFolderRequest,
  listFoldersRequest,
  renameFolderRequest,
  type SessionFolder,
} from "@/lib/session-actions";

/** The user's session folders, with create, rename and delete. */
export function useSessionFolders() {
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const refresh = useCallback(async () => {
    try {
      setFolders(await listFoldersRequest());
      setStatus("ready");
    } catch {
      setStatus("error");
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

  const create = useCallback(
    async (name: string) => {
      const folder = await createFolderRequest(name);
      await refresh();
      return folder;
    },
    [refresh],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameFolderRequest(id, name);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteFolderRequest(id);
      await refresh();
    },
    [refresh],
  );

  return { folders, status, refresh, create, rename, remove };
}
