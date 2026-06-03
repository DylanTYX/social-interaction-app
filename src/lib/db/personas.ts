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

/**
 * Returns the user's persona library, seeding the built-in presets the first
 * time we see them. The seeding happens inside this function so callers do
 * not need to think about it.
 */
export async function listPersonas(
  supabase: SupabaseClient,
  userId: string,
): Promise<PersonaRecord[]> {
  const { data, error } = await supabase
    .from("personas")
    .select(PERSONA_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  if (data && data.length > 0) {
    return data.map((row) => rowToRecord(row as PersonaRow));
  }

  // First-time user: seed presets.
  const seedRows = buildSeedRows(userId);
  const { data: inserted, error: seedError } = await supabase
    .from("personas")
    .insert(seedRows)
    .select(PERSONA_COLUMNS);

  if (seedError) throw seedError;

  return (inserted ?? []).map((row) => rowToRecord(row as PersonaRow));
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

  const seedRows = buildSeedRows(userId);
  const { error: seedError } = await supabase
    .from("personas")
    .insert(seedRows);
  if (seedError) throw seedError;

  return listPersonas(supabase, userId);
}
