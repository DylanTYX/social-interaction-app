import type { SupabaseClient } from "@supabase/supabase-js";
import { PRESET_PERSONAS, type PersonaConfig } from "@/lib/persona-engine";

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
    .order("updated_at", { ascending: false })
    // Bounded. Personas are one-click creatable ("Random persona",
    // "Duplicate"), so an unbounded select grows with the account and is
    // fetched whole on every dashboard load.
    .limit(200);

  if (error) throw error;
  return (data ?? []).map((row) => rowToRecord(row as PersonaRow));
}

/**
 * Presets that shipped once and have since been replaced, keyed by the old
 * name, valued by the `PRESET_PERSONAS` key that replaces them.
 *
 * Presets are copied into each account on its first library load and never
 * refreshed after that — only "Restore presets" prunes — so changing
 * `PRESET_PERSONAS` alone leaves every existing account holding the old one.
 */
export const RETIRED_PRESETS: Readonly<Record<string, string>> = {
  // Japanese has no accent voice; see the note on the replacement preset.
  "Yuki Tanaka": "aisyah rahman",
};

export interface PresetMaintenance {
  /** Retired preset rows rewritten as their replacement, keeping the row id. */
  replace: Array<{ id: string; name: string; config: PersonaConfig }>;
  /** Retired preset rows whose replacement is already in the library. */
  remove: string[];
  /** Shipped preset rows saved before presets carried a voice gender. */
  backfillVoice: Array<{ id: string; config: PersonaConfig }>;
}

/**
 * What an existing library needs to match the shipped presets. Pure, so it can
 * be tested without a database.
 *
 * A retired preset is rewritten in place rather than deleted and re-inserted:
 * a multi-round loop stores the interviewer as a persona id, and a deleted row
 * would silently hand that round back to the session's default interviewer.
 * Only `kind: "preset"` rows are touched — a user who saved their own persona
 * under a retired name keeps it. The voice backfill adds the one missing field
 * and leaves every other edit alone.
 */
export function planPresetMaintenance(
  existing: readonly PersonaRecord[],
): PresetMaintenance {
  const plan: PresetMaintenance = { replace: [], remove: [], backfillVoice: [] };
  const presetNames = new Set(
    existing.filter((row) => row.kind === "preset").map((row) => row.name),
  );
  const shippedByName = new Map(
    Object.values(PRESET_PERSONAS).map((config) => [config.name, config]),
  );

  for (const row of existing) {
    if (row.kind !== "preset") continue;

    const replacementKey = RETIRED_PRESETS[row.name];
    if (replacementKey) {
      const replacement = PRESET_PERSONAS[replacementKey];
      if (!replacement) continue;
      if (presetNames.has(replacement.name)) {
        plan.remove.push(row.id);
      } else {
        plan.replace.push({
          id: row.id,
          name: replacement.name,
          config: replacement,
        });
        presetNames.add(replacement.name);
      }
      continue;
    }

    const shipped = shippedByName.get(row.name);
    if (shipped?.voiceGender && row.config.voiceGender === undefined) {
      plan.backfillVoice.push({
        id: row.id,
        config: { ...row.config, voiceGender: shipped.voiceGender },
      });
    }
  }

  return plan;
}

async function maintainPresets(
  supabase: SupabaseClient,
  existing: PersonaRecord[],
): Promise<PersonaRecord[]> {
  const plan = planPresetMaintenance(existing);
  if (
    plan.replace.length === 0 &&
    plan.remove.length === 0 &&
    plan.backfillVoice.length === 0
  ) {
    return existing;
  }

  try {
    for (const row of plan.replace) {
      const { error } = await supabase
        .from("personas")
        .update({ name: row.name, config: row.config })
        .eq("id", row.id);
      if (error) throw error;
    }
    for (const id of plan.remove) {
      const { error } = await supabase.from("personas").delete().eq("id", id);
      if (error) throw error;
    }
    for (const row of plan.backfillVoice) {
      const { error } = await supabase
        .from("personas")
        .update({ config: row.config })
        .eq("id", row.id);
      if (error) throw error;
    }
  } catch (error) {
    // Housekeeping must never cost someone their library. The next load
    // re-plans from whatever did commit and tries again.
    console.error("[personas] preset maintenance failed", error);
    return existing;
  }

  return selectPersonas(supabase);
}

/**
 * Returns the user's persona library, seeding the built-in presets the first
 * time we see them. The seeding happens inside this function so callers do
 * not need to think about it.
 *
 * The read-then-insert is inherently racy — two concurrent first loads (two
 * tabs, or the library and the setup wizard) both see an empty table. The
 * partial unique index `personas_user_preset_name_idx` (`0001_schema.sql`) makes
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
    return maintainPresets(supabase, existing);
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
  // Restore before removing, never the other way round.
  //
  // This was DELETE-all-presets then INSERT-the-seeds, with no transaction. Any
  // failure in the insert — a dropped connection, a timeout, an RLS hiccup —
  // left the user with **no presets at all** and no way back: `listPersonas`
  // only re-seeds when the table is completely empty, so anyone who had saved a
  // single persona of their own would never get the presets again. Permanent,
  // silent data loss from a button labelled "Restore presets".
  //
  // Each step below leaves a valid library if the next one fails. The worst
  // outcome is now a stale preset that should have been pruned, which the next
  // reset clears.
  const seedRows = buildSeedRows(userId);

  // 1. Make sure every preset exists. A concurrent reset or first-load may have
  //    seeded already; the partial unique index turns that into a conflict
  //    rather than duplicates.
  const { error: seedError } = await supabase.from("personas").insert(seedRows);
  if (seedError && !isUniqueViolation(seedError)) throw seedError;

  // 2. Reset the ones that already existed back to their canonical config —
  //    this is what "restore" means for a preset the user has edited. Six rows,
  //    on an explicit user action, so a loop is fine. `upsert` cannot do this
  //    in one call: the unique index is partial (`where kind = 'preset'`) and
  //    PostgREST has no way to supply the matching predicate for inference.
  for (const row of seedRows) {
    const { error: updateError } = await supabase
      .from("personas")
      .update({ config: row.config })
      .eq("user_id", userId)
      .eq("kind", "preset")
      .eq("name", row.name);
    if (updateError) throw updateError;
  }

  // 3. Drop presets that are no longer part of the shipped set. Last, because
  //    it is the only destructive step.
  const { error: pruneError } = await supabase
    .from("personas")
    .delete()
    .eq("user_id", userId)
    .eq("kind", "preset")
    .not("name", "in", `(${seedRows.map((row) => `"${row.name}"`).join(",")})`);
  if (pruneError) throw pruneError;

  return selectPersonas(supabase);
}
