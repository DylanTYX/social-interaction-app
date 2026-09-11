import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Folders for grouping sessions (`session_folders` in `0001_schema.sql`).
 *
 * A session sits in at most one folder. Deleting a folder leaves its sessions
 * in place, unfiled — `folder_id` is `on delete set null` — because a folder is
 * an arrangement of someone's history, not part of it.
 *
 * Plain table writes, unlike sessions: a folder carries nothing server-owned,
 * so the owner-only RLS policy is the whole rule.
 */

export interface SessionFolderRecord {
  id: string;
  name: string;
  /** Sessions currently filed here. Zero on a freshly written row. */
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FolderRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  interview_sessions?: Array<{ count: number }> | null;
}

const FOLDER_COLUMNS = "id, name, created_at, updated_at";

function rowToFolder(row: FolderRow): SessionFolderRecord {
  const count = Array.isArray(row.interview_sessions)
    ? row.interview_sessions[0]?.count
    : undefined;
  return {
    id: row.id,
    name: row.name,
    sessionCount: typeof count === "number" ? count : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Postgres unique violation, from `session_folders_user_name_idx`. */
export function isDuplicateFolderName(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

export async function listSessionFolders(
  supabase: SupabaseClient,
): Promise<SessionFolderRecord[]> {
  const { data, error } = await supabase
    .from("session_folders")
    .select(`${FOLDER_COLUMNS}, interview_sessions(count)`)
    .order("name", { ascending: true })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as FolderRow[]).map(rowToFolder);
}

export async function createSessionFolder(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<SessionFolderRecord> {
  const { data, error } = await supabase
    .from("session_folders")
    .insert({ user_id: userId, name })
    .select(FOLDER_COLUMNS)
    .single();
  if (error) throw error;
  return rowToFolder(data as FolderRow);
}

export async function renameSessionFolder(
  supabase: SupabaseClient,
  id: string,
  name: string,
): Promise<SessionFolderRecord | null> {
  const { data, error } = await supabase
    .from("session_folders")
    .update({ name })
    .eq("id", id)
    .select(FOLDER_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToFolder(data as FolderRow) : null;
}

export async function deleteSessionFolder(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("session_folders").delete().eq("id", id);
  if (error) throw error;
}
