import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRESET_PERSONAS,
  type PersonaConfig,
} from "@/lib/personaEngine";

export type PersonaKind = "preset" | "user";

export interface PersonaRecord {
  id: string;
  kind: PersonaKind;
  name: string;
  config: PersonaConfig;
  updatedAt: string;
}

interface PersonaRow {
  id: string;
  kind: PersonaKind;
  name: string;
  config: PersonaConfig;
  updated_at: string;
}

const PERSONA_COLUMNS = "id, kind, name, config, updated_at";

function rowToRecord(row: PersonaRow): PersonaRecord {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    config: row.config,
    updatedAt: row.updated_at,
  };
}

function buildSeedRows(userId: string): {
  user_id: string;
  kind: PersonaKind;
  name: string;
  config: PersonaConfig;
}[] {
  return Object.values(PRESET_PERSONAS).map((config) => ({
    user_id: userId,
    kind: "preset" as const,
    name: config.name,
    config,
  }));
}

/** Postgres unique-violation. Raised by `personas_user_preset_name_idx`. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

async function selectPersonas(
  supabase: SupabaseClient,
): Promise<PersonaRecord[]> {
  const { data, error } = await supabase
    .from("personas")
    .select(PERSONA_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => rowToRecord(row as PersonaRow));
}

/**
 * Returns the user's persona library, seeding the built-in presets the first
 * time we see them. The seeding happens inside this function so callers do
 * not need to think about it.
 *
 * The read-then-insert is inherently racy — two concurrent first loads (two
 * tabs, or the library and the setup wizard) both see an empty table. The
 * partial unique index `personas_user_preset_name_idx` (migration 0005) makes
 * the loser's insert fail instead of duplicating every preset; we treat that
 * failure as "somebody else just seeded" and re-read.
 *
 * The index is partial (`where kind = 'preset'`) so users can still name their
 * own personas freely, which also means it cannot serve as an `upsert`
 * arbiter — hence catch-and-re-read rather than `onConflict`.
 */
export async function listPersonas(
  supabase: SupabaseClient,
  userId: string,
): Promise<PersonaRecord[]> {
  const existing = await selectPersonas(supabase);
  if (existing.length > 0) {
    return existing;
  }

  // First-time user: seed presets.
  const { error: seedError } = await supabase
    .from("personas")
    .insert(buildSeedRows(userId));

  if (seedError && !isUniqueViolation(seedError)) throw seedError;

  // Re-read either way: on success this picks up the inserted rows, and on a
  // conflict it picks up whatever the concurrent writer committed.
  return selectPersonas(supabase);
}

export async function createPersona(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; config: PersonaConfig; kind?: PersonaKind },
): Promise<PersonaRecord> {
  const { data, error } = await supabase
    .from("personas")
    .insert({
      user_id: userId,
      kind: input.kind ?? "user",
      name: input.name,
      config: input.config,
    })
    .select(PERSONA_COLUMNS)
    .single();

  if (error) throw error;
  return rowToRecord(data as PersonaRow);
}

export async function updatePersona(
  supabase: SupabaseClient,
  id: string,
  input: { name: string; config: PersonaConfig },
): Promise<PersonaRecord> {
  const { data, error } = await supabase
    .from("personas")
    .update({ name: input.name, config: input.config })
    .eq("id", id)
    .select(PERSONA_COLUMNS)
    .single();

  if (error) throw error;
  return rowToRecord(data as PersonaRow);
}

export async function deletePersona(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("personas").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Restore the built-in presets. We delete the user's preset rows and re-seed
 * — user-created personas are left untouched.
 */
export async function resetPersonaPresets(
  supabase: SupabaseClient,
  userId: string,
): Promise<PersonaRecord[]> {
  const { error: delError } = await supabase
    .from("personas")
    .delete()
    .eq("user_id", userId)
    .eq("kind", "preset");
  if (delError) throw delError;

  const { error: seedError } = await supabase
    .from("personas")
    .insert(buildSeedRows(userId));
  // A concurrent reset or first-load may have re-seeded between our delete and
  // this insert; the unique index makes that a conflict rather than duplicates.
  if (seedError && !isUniqueViolation(seedError)) throw seedError;

  return selectPersonas(supabase);
}
