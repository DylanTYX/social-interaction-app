import {
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

const NATIONALITY_POOL = [
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

export function generateRandomPersonaConfig(): PersonaConfig {
  const firstName = pickOne(FIRST_NAME_POOL);
  const lastName = pickOne(LAST_NAME_POOL);

  return {
    name: `${firstName} ${lastName}`,
    nationality: pickOne(NATIONALITY_POOL),
    industry: pickOne(INDUSTRY_POOL),
    seniority: pickOne(SENIORITY_POOL),
    communicationStyle: pickOne(COMMUNICATION_STYLE_POOL),
    strictness: ((Math.floor(Math.random() * 9) +
      2) as PersonaConfig["strictness"]),
    warmth: ((Math.floor(Math.random() * 9) + 2) as PersonaConfig["warmth"]),
    pace: ((Math.floor(Math.random() * 9) + 2) as PersonaConfig["pace"]),
    pushback: ((Math.floor(Math.random() * 9) + 2) as PersonaConfig["pushback"]),
    yearsExperience: 4 + Math.floor(Math.random() * 22),
    personalityTraits: pickMany(TRAITS_POOL, 3),
    boundaries: pickMany(BOUNDARIES_POOL, 3),
    interestAreas: pickMany(INTERESTS_POOL, 3),
  };
}

export function findEntryMatchingConfig(
  config: PersonaConfig,
  library: PersonaLibraryEntry[],
): PersonaLibraryEntry | null {
  return (
    library.find(
      (entry) =>
        entry.config.name === config.name &&
        entry.config.nationality === config.nationality &&
        entry.config.industry === config.industry &&
        entry.config.seniority === config.seniority &&
        entry.config.communicationStyle === config.communicationStyle &&
        entry.config.strictness === config.strictness &&
        entry.config.warmth === config.warmth &&
        (entry.config.pace ?? 5) === (config.pace ?? 5) &&
        (entry.config.pushback ?? 5) === (config.pushback ?? 5),
    ) ?? null
  );
}
