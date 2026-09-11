import { readJson } from "@/lib/api/fetch-json";

/**
 * Client requests for organising sessions, in one place so the
 * report page, the sessions page and its dialogs all send the same shapes.
 */

export interface SessionPatch {
  /** Empty or null resets to the generated title. */
  title?: string | null;
  tags?: string[];
  pinned?: boolean;
  notes?: string | null;
  archived?: boolean;
}

export interface OrganisedSession {
  id: string;
  title: string | null;
  tags: string[];
  pinned: boolean;
  notes: string | null;
  archivedAt: string | null;
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
  | "delete";

export async function bulkSessionsRequest(body: {
  ids: string[];
  action: BulkSessionAction;
  tag?: string;
}): Promise<{ updated: number; failed: number }> {
  const response = await fetch("/api/sessions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<{ updated: number; failed: number }>(response);
}

export async function listTagsRequest(): Promise<Array<{ tag: string; count: number }>> {
  const response = await fetch("/api/sessions/tags", { cache: "no-store" });
  return (await readJson<{ tags: Array<{ tag: string; count: number }> }>(response)).tags;
}
