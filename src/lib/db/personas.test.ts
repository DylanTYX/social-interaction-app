import { describe, expect, it } from "vitest";

/**
 * Presets are copied into an account once and never refreshed, so replacing
 * one in `PRESET_PERSONAS` did nothing for anyone who already had a library:
 * the Japanese preset — which can only ever speak neutral English — stayed.
 * And no preset carried a voice gender, so the male presets spoke as women.
 * These pin what an existing library is changed to, and what is never touched.
 */

import { PRESET_PERSONAS, type PersonaConfig } from "@/lib/persona-engine";
import {
  planPresetMaintenance,
  RETIRED_PRESETS,
  type PersonaRecord,
} from "@/lib/db/personas";

const yuki: PersonaConfig = {
  ...PRESET_PERSONAS["aisyah rahman"],
  name: "Yuki Tanaka",
  nationality: "Japanese",
  voiceGender: undefined,
};

function row(
  id: string,
  kind: PersonaRecord["kind"],
  config: PersonaConfig,
): PersonaRecord {
  return { id, kind, name: config.name, config, updatedAt: "2026-09-01" };
}

const withoutVoice = (key: string): PersonaConfig => ({
  ...PRESET_PERSONAS[key],
  voiceGender: undefined,
});

describe("a retired preset", () => {
  it("is rewritten as its replacement, keeping the row id a loop may reference", () => {
    const plan = planPresetMaintenance([row("p-yuki", "preset", yuki)]);
    expect(plan.replace).toHaveLength(1);
    expect(plan.replace[0].id).toBe("p-yuki");
    expect(plan.replace[0].name).toBe("Aisyah Rahman");
    expect(plan.replace[0].config.nationality).toBe("Singaporean");
    expect(plan.remove).toEqual([]);
  });

  it("is removed when the replacement is already there, instead of colliding", () => {
    // The partial unique index on (user_id, name) for presets would reject a
    // second "Aisyah Rahman", e.g. after a Restore presets.
    const plan = planPresetMaintenance([
      row("p-yuki", "preset", yuki),
      row("p-aisyah", "preset", PRESET_PERSONAS["aisyah rahman"]),
    ]);
    expect(plan.remove).toEqual(["p-yuki"]);
    expect(plan.replace).toEqual([]);
  });

  it("is left alone when the user saved it as their own persona", () => {
    const plan = planPresetMaintenance([row("u-yuki", "user", yuki)]);
    expect(plan).toEqual({ replace: [], remove: [], backfillVoice: [] });
  });

  it("points at a preset that exists", () => {
    for (const key of Object.values(RETIRED_PRESETS)) {
      expect(PRESET_PERSONAS[key], key).toBeDefined();
    }
  });
});

describe("the voice gender backfill", () => {
  it("adds the shipped gender to a preset saved without one", () => {
    const plan = planPresetMaintenance([
      row("p-marcus", "preset", withoutVoice("marcus johnson")),
    ]);
    expect(plan.backfillVoice).toHaveLength(1);
    expect(plan.backfillVoice[0].config.voiceGender).toBe("male");
  });

  it("keeps the user's other edits to that preset", () => {
    const edited = { ...withoutVoice("lars petersen"), strictness: 3 as const };
    const plan = planPresetMaintenance([row("p-lars", "preset", edited)]);
    expect(plan.backfillVoice[0].config.strictness).toBe(3);
    expect(plan.backfillVoice[0].config.voiceGender).toBe("male");
  });

  it("does not override a voice gender someone chose", () => {
    const chosen = { ...PRESET_PERSONAS["marcus johnson"], voiceGender: "female" as const };
    const plan = planPresetMaintenance([row("p-marcus", "preset", chosen)]);
    expect(plan.backfillVoice).toEqual([]);
  });
});

describe("a library already up to date", () => {
  it("needs nothing", () => {
    const library = Object.values(PRESET_PERSONAS).map((config, i) =>
      row(`p-${i}`, "preset", config),
    );
    expect(planPresetMaintenance(library)).toEqual({
      replace: [],
      remove: [],
      backfillVoice: [],
    });
  });
});
