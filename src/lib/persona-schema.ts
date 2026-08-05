import {
  PERSONA_DIAL_DEFAULT,
  type CommunicationStyle,
  type PersonaConfig,
} from "@/lib/persona-engine";

/**
 * Validation for a `PersonaConfig` arriving from an untrusted source — a
 * request body, or localStorage.
 *
 * This replaces three near-identical copies in the API routes, each of which
 * checked 4 of the 13 fields and then cast. The unchecked fields are not
 * inert: `strictness` and `warmth` feed arithmetic in `decideInterviewAction`,
 * and `communicationStyle` indexes a `Record<CommunicationStyle, string>` in
 * `personaEngine`, where an unrecognised value silently puts `undefined` into
 * the interviewer's prompt.
 *
 * Out-of-range dials are clamped rather than rejected — a persona saved before
 * a range changed should still open, just bounded.
 */

const COMMUNICATION_STYLES: readonly CommunicationStyle[] = [
  "direct",
  "diplomatic",
  "collaborative",
  "analytical",
];

function isCommunicationStyle(value: unknown): value is CommunicationStyle {
  return (
    typeof value === "string" &&
    (COMMUNICATION_STYLES as readonly string[]).includes(value)
  );
}

/** Clamp a 1-10 dial, falling back to the neutral default. */
function dial(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return PERSONA_DIAL_DEFAULT;
  }
  const rounded = Math.round(value);
  const bounded = Math.min(10, Math.max(1, rounded));
  return bounded as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Returns a fully-populated `PersonaConfig`, or null when the four fields that
 * have no sensible default are missing. Everything else is normalised.
 */
export function parsePersonaConfig(value: unknown): PersonaConfig | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;

  const name = nonEmptyString(input.name);
  const nationality = nonEmptyString(input.nationality);
  const industry = nonEmptyString(input.industry);
  const seniority = nonEmptyString(input.seniority);

  if (!name || !nationality || !industry || !seniority) return null;

  const yearsExperience =
    typeof input.yearsExperience === "number" &&
    Number.isFinite(input.yearsExperience)
      ? Math.max(0, Math.round(input.yearsExperience))
      : 0;

  return {
    name,
    nationality,
    industry,
    seniority,
    communicationStyle: isCommunicationStyle(input.communicationStyle)
      ? input.communicationStyle
      : "direct",
    strictness: dial(input.strictness),
    warmth: dial(input.warmth),
    pace: dial(input.pace),
    pushback: dial(input.pushback),
    yearsExperience,
    personalityTraits: stringList(input.personalityTraits),
    boundaries: stringList(input.boundaries),
    interestAreas: stringList(input.interestAreas),
  };
}
