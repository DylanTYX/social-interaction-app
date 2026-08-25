import {
  QUESTIONING_STYLES,
  type CommunicationStyle,
  type PersonaConfig,
} from "./persona-engine";
import { readJson } from "@/lib/api/fetch-json";

/**
 * Persona library — backed by Supabase via the `/api/personas` routes.
 *
 * The built-in `PRESET_PERSONAS` are seeded into the user's library on first
 * load (server-side, see `lib/db/personas.ts`). After that, every persona
 * lives in Postgres and behaves the same: editable, deletable, duplicatable.
 *
 * This module keeps three responsibilities:
 *   1. Type definitions (PersonaKind, PersonaLibraryEntry).
 *   2. Pure helpers used by the UI (`generateRandomPersonaConfig`,
 *      `findEntryMatchingConfig`).
 *   3. Thin fetch wrappers around the API routes for CRUD.
 */

export type PersonaKind = "preset" | "user";

export interface PersonaLibraryEntry {
  id: string;
  kind: PersonaKind;
  config: PersonaConfig;
  /** ms since epoch, used to sort the library "most recent first". */
  updatedAt: number;
}

interface ApiPersona {
  id: string;
  kind: PersonaKind;
  name: string;
  config: PersonaConfig;
  updatedAt: string;
}

function fromApi(persona: ApiPersona): PersonaLibraryEntry {
  return {
    id: persona.id,
    kind: persona.kind,
    config: persona.config,
    updatedAt: Date.parse(persona.updatedAt) || Date.now(),
  };
}

/**
 * Fetches the user's persona library. Throws if the user is unauthenticated
 * or if the network call fails.
 */
export async function fetchPersonaLibrary(): Promise<PersonaLibraryEntry[]> {
  const response = await fetch("/api/personas", { cache: "no-store" });
  const { personas } = await readJson<{ personas: ApiPersona[] }>(response);
  return personas.map(fromApi);
}

export async function createPersonaEntry(input: {
  config: PersonaConfig;
  kind?: PersonaKind;
}): Promise<PersonaLibraryEntry> {
  const response = await fetch("/api/personas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.config.name,
      config: input.config,
      kind: input.kind ?? "user",
    }),
  });
  const { persona } = await readJson<{ persona: ApiPersona }>(response);
  return fromApi(persona);
}

export async function updatePersonaEntry(
  id: string,
  config: PersonaConfig,
): Promise<PersonaLibraryEntry> {
  const response = await fetch(`/api/personas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: config.name, config }),
  });
  const { persona } = await readJson<{ persona: ApiPersona }>(response);
  return fromApi(persona);
}

export async function deletePersonaEntry(id: string): Promise<void> {
  const response = await fetch(`/api/personas/${id}`, { method: "DELETE" });
  await readJson<{ ok: boolean }>(response);
}

export async function duplicatePersonaEntry(
  entry: PersonaLibraryEntry,
): Promise<PersonaLibraryEntry> {
  return createPersonaEntry({
    kind: "user",
    config: { ...entry.config, name: `${entry.config.name} (copy)` },
  });
}

export async function resetPersonaLibrary(): Promise<PersonaLibraryEntry[]> {
  const response = await fetch("/api/personas/reset", { method: "POST" });
  const { personas } = await readJson<{ personas: ApiPersona[] }>(response);
  return personas.map(fromApi);
}

// ---------------------------------------------------------------------------
// Pure helpers (no I/O)
// ---------------------------------------------------------------------------

/**
 * Nationalities the persona randomiser can produce.
 *
 * Exported so `persona-voice.test.ts` can assert every one of them resolves to
 * a voice rather than duplicating the list and drifting from it: adding a 21st
 * nationality here should fail that test, not silently fall back.
 */
export const NATIONALITY_POOL = [
  "American",
  "British",
  "Brazilian",
  "Canadian",
  "Chinese",
  "Danish",
  "French",
  "German",
  "Indian",
  "Indonesian",
  "Italian",
  "Japanese",
  "Kenyan",
  "Korean",
  "Mexican",
  "Nigerian",
  "Singaporean",
  "Spanish",
  "Swedish",
  "Vietnamese",
];

const INDUSTRY_POOL = [
  "Big Tech",
  "Consulting",
  "Consumer goods",
  "E-commerce",
  "Education",
  "Energy",
  "Finance",
  "Healthcare",
  "Hospitality",
  "Logistics",
  "Manufacturing",
  "Marketing",
  "Media",
  "Nonprofit",
  "Pharma",
  "Real estate",
  "Renewable Energy",
  "Telecom",
];

const SENIORITY_POOL = [
  "Associate Product Manager",
  "Senior Product Manager",
  "Director of Product",
  "VP of Product",
  "Senior Engineer",
  "Engineering Manager",
  "VP of Engineering",
  "Director of Operations",
  "Plant Director",
  "Managing Partner",
  "Chief Marketing Officer",
  "Chief Technology Officer",
  "Head of People",
];

const COMMUNICATION_STYLE_POOL: CommunicationStyle[] = [
  "direct",
  "diplomatic",
  "collaborative",
  "analytical",
];

const TRAITS_POOL = [
  "analytical",
  "ambitious",
  "candid",
  "curious",
  "data-driven",
  "decisive",
  "detail-oriented",
  "empathetic",
  "growth-focused",
  "impatient with vagueness",
  "mentor-oriented",
  "methodical",
  "patient",
  "people-focused",
  "perfectionistic",
  "pragmatic",
  "relationship-focused",
  "skeptical",
  "strategic",
  "systems-thinking",
];

const BOUNDARIES_POOL = [
  "avoiding accountability",
  "dismissing junior voices",
  "hand-wavy explanations",
  "ignored stakeholders",
  "ignoring market research",
  "ignoring scalability",
  "lack of data",
  "overpromising on timelines",
  "poor listening",
  "process shortcuts",
  "quality compromises",
  "shifting goals mid-conversation",
  "unclear procedures",
];

const INTERESTS_POOL = [
  "brand strategy",
  "consumer insights",
  "cross-functional alignment",
  "customer empathy",
  "innovation",
  "lean systems",
  "metrics definition",
  "operational efficiency",
  "process improvement",
  "product strategy",
  "quality control",
  "stakeholder management",
  "strategic thinking",
  "system architecture",
  "team development",
  "technical leadership",
  "user research",
];

const FIRST_NAME_POOL = [
  "Alex",
  "Amara",
  "Aiko",
  "Bashir",
  "Camila",
  "Daniel",
  "Elena",
  "Felix",
  "Hana",
  "Ibrahim",
  "Ines",
  "Jin",
  "Kira",
  "Liam",
  "Maya",
  "Nadia",
  "Omar",
  "Priya",
  "Quentin",
  "Ravi",
  "Sofia",
  "Theo",
  "Uma",
  "Viktor",
  "Wei",
  "Yusuf",
  "Zoe",
];

const LAST_NAME_POOL = [
  "Adler",
  "Bauer",
  "Castillo",
  "Chen",
  "Davis",
  "Ferraro",
  "Garcia",
  "Hassan",
  "Ito",
  "Johansson",
  "Khan",
  "Lopez",
  "Martins",
  "Müller",
  "Nakamura",
  "Okafor",
  "Patel",
  "Rossi",
  "Singh",
  "Tan",
  "Uchida",
  "Vidal",
  "Williams",
];

function pickOne<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickMany<T>(pool: readonly T[], count: number): T[] {
  const copy = [...pool];
  const result: T[] = [];
  const targetCount = Math.min(count, copy.length);
  for (let i = 0; i < targetCount; i += 1) {
    const index = Math.floor(Math.random() * copy.length);
    const [item] = copy.splice(index, 1);
    if (item !== undefined) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Only the two that map to a voice. "unspecified" is a real setting a user can
 * choose, but rolling it at random would just mean "female" by list order —
 * the randomiser should produce a decided persona, not an undecided one.
 */
const VOICE_GENDER_POOL: PersonaConfig["voiceGender"][] = ["female", "male"];

/**
 * The starting point for "New persona".
 *
 * Empty identity, every dial at the neutral 5, the realism-default style, no
 * voice preference, no lists. Deliberately not a preset clone: the wizard's
 * default persona is Sarah Chen, and "New" that opens on someone else's name
 * is a duplicate with extra steps. `parsePersonaConfig` refuses this until the
 * four identity fields are filled, which is exactly what the dialog's Save
 * gate mirrors.
 */
export function createBlankPersonaConfig(): PersonaConfig {
  return {
    name: "",
    nationality: "",
    industry: "",
    seniority: "",
    communicationStyle: "direct",
    strictness: 5,
    warmth: 5,
    pace: 5,
    pushback: 5,
    probingDepth: 5,
    unpredictability: 5,
    questioningStyle: "conversational",
    voiceGender: "unspecified",
    yearsExperience: 5,
    personalityTraits: [],
    boundaries: [],
    interestAreas: [],
  };
}

/** The identity fields without which the server rejects a persona. */
export function personaIdentityComplete(config: PersonaConfig): boolean {
  return [
    config.name,
    config.nationality,
    config.industry,
    config.seniority,
  ].every((field) => field.trim().length > 0);
}

export function generateRandomPersonaConfig(): PersonaConfig {
  const firstName = pickOne(FIRST_NAME_POOL);
  const lastName = pickOne(LAST_NAME_POOL);

  return {
    name: `${firstName} ${lastName}`,
    nationality: pickOne(NATIONALITY_POOL),
    industry: pickOne(INDUSTRY_POOL),
    seniority: pickOne(SENIORITY_POOL),
    communicationStyle: pickOne(COMMUNICATION_STYLE_POOL),
    strictness: (Math.floor(Math.random() * 9) +
      2) as PersonaConfig["strictness"],
    warmth: (Math.floor(Math.random() * 9) + 2) as PersonaConfig["warmth"],
    pace: (Math.floor(Math.random() * 9) + 2) as PersonaConfig["pace"],
    pushback: (Math.floor(Math.random() * 9) + 2) as PersonaConfig["pushback"],
    probingDepth: (Math.floor(Math.random() * 9) +
      2) as PersonaConfig["probingDepth"],
    unpredictability: (Math.floor(Math.random() * 9) +
      2) as PersonaConfig["unpredictability"],
    questioningStyle: pickOne(QUESTIONING_STYLES),
    voiceGender: pickOne(VOICE_GENDER_POOL),
    yearsExperience: 4 + Math.floor(Math.random() * 22),
    personalityTraits: pickMany(TRAITS_POOL, 3),
    boundaries: pickMany(BOUNDARIES_POOL, 3),
    interestAreas: pickMany(INTERESTS_POOL, 3),
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Field-complete equality, with the same defaults `parsePersonaConfig` applies.
 *
 * The matcher this replaces compared identity, style and the dials — and not
 * `yearsExperience`, traits, boundaries or interests, all of which are
 * editable. A years-only change therefore still "matched" its saved entry:
 * the wizard kept the card highlighted, "Unsaved changes" never appeared,
 * and the session launched attributed to a persona it no longer was.
 * Optional fields compare through their defaults so an entry saved before a
 * field existed still equals the same persona freshly parsed.
 */
export function personaConfigEquals(
  a: PersonaConfig,
  b: PersonaConfig,
): boolean {
  return (
    a.name === b.name &&
    a.nationality === b.nationality &&
    a.industry === b.industry &&
    a.seniority === b.seniority &&
    a.communicationStyle === b.communicationStyle &&
    a.strictness === b.strictness &&
    a.warmth === b.warmth &&
    (a.pace ?? 5) === (b.pace ?? 5) &&
    (a.pushback ?? 5) === (b.pushback ?? 5) &&
    (a.probingDepth ?? 5) === (b.probingDepth ?? 5) &&
    (a.unpredictability ?? 5) === (b.unpredictability ?? 5) &&
    (a.questioningStyle ?? "conversational") ===
      (b.questioningStyle ?? "conversational") &&
    (a.voiceGender ?? "unspecified") === (b.voiceGender ?? "unspecified") &&
    a.yearsExperience === b.yearsExperience &&
    sameList(a.personalityTraits, b.personalityTraits) &&
    sameList(a.boundaries, b.boundaries) &&
    sameList(a.interestAreas, b.interestAreas)
  );
}

export function findEntryMatchingConfig(
  config: PersonaConfig,
  library: PersonaLibraryEntry[],
): PersonaLibraryEntry | null {
  return (
    library.find((entry) => personaConfigEquals(entry.config, config)) ?? null
  );
}

/**
 * One order for both surfaces: your personas first, most recent first, then
 * the presets in their seeded order. The library page sorted by recency
 * alone and the wizard by kind, so the same six cards appeared in two orders
 * — "your stuff on top, presets stable" is right on both screens.
 */
export function sortPersonaLibrary(
  library: PersonaLibraryEntry[],
): PersonaLibraryEntry[] {
  return [...library].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "user" ? -1 : 1;
    if (a.kind === "user") return b.updatedAt - a.updatedAt;
    return a.updatedAt - b.updatedAt;
  });
}
