import { readJson } from "@/lib/api/fetch-json";

/**
 * Client requests for organising sessions and folders, in one place so the
 * report page, the sessions page and its dialogs all send the same shapes.
 */

export interface SessionPatch {
  /** Empty or null resets to the generated title. */
  title?: string | null;
  tags?: string[];
  pinned?: boolean;
  notes?: string | null;
  archived?: boolean;
  /** Null takes the session out of its folder. */
  folderId?: string | null;
}

export interface OrganisedSession {
  id: string;
  title: string | null;
  tags: string[];
  pinned: boolean;
  notes: string | null;
  archivedAt: string | null;
  folderId: string | null;
}

export async function patchSessionRequest(
  id: string,
  patch: SessionPatch,
): Promise<OrganisedSession> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const { session } = await readJson<{ session: OrganisedSession }>(response);
  return session;
}

export type BulkSessionAction =
  | "archive"
  | "unarchive"
  | "pin"
  | "unpin"
  | "add_tag"
  | "remove_tag"
  | "move"
  | "delete";

export async function bulkSessionsRequest(body: {
  ids: string[];
  action: BulkSessionAction;
  tag?: string;
  folderId?: string | null;
}): Promise<{ updated: number; failed: number }> {
  const response = await fetch("/api/sessions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<{ updated: number; failed: number }>(response);
}

export interface SessionFolder {
  id: string;
  name: string;
  sessionCount: number;
}

export async function listFoldersRequest(): Promise<SessionFolder[]> {
  const response = await fetch("/api/session-folders", { cache: "no-store" });
  return (await readJson<{ folders: SessionFolder[] }>(response)).folders;
}

export async function createFolderRequest(name: string): Promise<SessionFolder> {
  const response = await fetch("/api/session-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return (await readJson<{ folder: SessionFolder }>(response)).folder;
}

export async function renameFolderRequest(id: string, name: string): Promise<SessionFolder> {
  const response = await fetch(`/api/session-folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return (await readJson<{ folder: SessionFolder }>(response)).folder;
}

export async function deleteFolderRequest(id: string): Promise<void> {
  const response = await fetch(`/api/session-folders/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await readJson<{ ok: boolean }>(response);
}

export async function listTagsRequest(): Promise<Array<{ tag: string; count: number }>> {
  const response = await fetch("/api/sessions/tags", { cache: "no-store" });
  return (await readJson<{ tags: Array<{ tag: string; count: number }> }>(response)).tags;
}
