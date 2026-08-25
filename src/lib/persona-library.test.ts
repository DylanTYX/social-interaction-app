import { describe, expect, it } from "vitest";

import {
  createBlankPersonaConfig,
  findEntryMatchingConfig,
  personaConfigEquals,
  sortPersonaLibrary,
  type PersonaLibraryEntry,
} from "@/lib/persona-library";
import { PRESET_PERSONAS, type PersonaConfig } from "@/lib/persona-engine";

const yuki = PRESET_PERSONAS["yuki tanaka"];

function entry(
  id: string,
  kind: PersonaLibraryEntry["kind"],
  config: PersonaConfig,
  updatedAt: number,
): PersonaLibraryEntry {
  return { id, kind, config, updatedAt };
}

describe("personaConfigEquals", () => {
  it("is reflexive, and blind to omitted-vs-default optional fields", () => {
    expect(personaConfigEquals(yuki, { ...yuki })).toBe(true);
    // An entry saved before a field existed equals the same persona parsed
    // today with the default filled in — every other field is identical, so
    // the only question is whether `undefined` and the default are treated
    // as the same value. They must be.
    expect(
      personaConfigEquals(
        { ...yuki, pace: undefined, questioningStyle: undefined },
        { ...yuki, pace: 5, questioningStyle: "conversational" },
      ),
    ).toBe(true);
  });

  it("notices the fields the old matcher ignored", () => {
    // Years, traits, boundaries and interests are all editable. A matcher
    // that skipped them kept a years-only edit "unmodified", which is how
    // "Update saved" never appeared and a tweaked interviewer launched under
    // the untouched entry's id.
    expect(
      personaConfigEquals(yuki, {
        ...yuki,
        yearsExperience: yuki.yearsExperience + 1,
      }),
    ).toBe(false);
    expect(
      personaConfigEquals(yuki, {
        ...yuki,
        personalityTraits: [...yuki.personalityTraits, "curious"],
      }),
    ).toBe(false);
    expect(personaConfigEquals(yuki, { ...yuki, voiceGender: "male" })).toBe(
      false,
    );
  });
});

describe("findEntryMatchingConfig", () => {
  it("returns the entry for an untouched config and null after a years edit", () => {
    const library = [entry("a", "preset", yuki, 1)];
    expect(findEntryMatchingConfig({ ...yuki }, library)?.id).toBe("a");
    expect(
      findEntryMatchingConfig({ ...yuki, yearsExperience: 1 }, library),
    ).toBeNull();
  });
});

describe("sortPersonaLibrary", () => {
  it("puts custom personas first (newest first), then presets in seeded order", () => {
    const blank = { ...createBlankPersonaConfig(), name: "x" };
    const sorted = sortPersonaLibrary([
      entry("p2", "preset", yuki, 2),
      entry("u-old", "user", blank, 10),
      entry("p1", "preset", yuki, 1),
      entry("u-new", "user", blank, 20),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["u-new", "u-old", "p1", "p2"]);
  });
});
