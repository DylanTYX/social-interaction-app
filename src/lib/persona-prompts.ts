import {
  generatePersonaPrompt,
  getPersonaConfig,
  getAvailablePersonas,
} from "./personaEngine";

/**
 * Backward compatibility: Generate persona prompts on-the-fly from engine configs
 * This allows the existing API to work unchanged while using the new dynamic system
 */
export const PERSONA_PROMPTS = new Proxy(
  {},
  {
    get: (target, prop: string | symbol) => {
      if (typeof prop !== "string") return undefined;
      const config = getPersonaConfig(prop);
      if (!config) return undefined;
      return generatePersonaPrompt(config);
    },
    has: (target, prop) => {
      if (typeof prop !== "string") return false;
      return getPersonaConfig(prop) !== null;
    },
    ownKeys: () => {
      return getAvailablePersonas();
    },
  },
) as Record<string, string>;

export const PERSONA_ALIASES: Record<string, string> = {
  sarah: "sarah chen",
  marcus: "marcus johnson",
  yuki: "yuki tanaka",
  priya: "priya sharma",
  lars: "lars petersen",
  isabella: "isabella rodriguez",
};

export type PersonaKey = string;

export type ResolvedPersona = {
  key: PersonaKey;
  description: string;
};

export function resolvePersona(personaName: string): ResolvedPersona | null {
  const normalized = personaName.trim().toLowerCase();
  const resolvedKey =
    PERSONA_ALIASES[normalized] ?? normalized.replace(/\s+/g, " ");

  const config = getPersonaConfig(resolvedKey);
  if (!config) {
    return null;
  }

  return {
    key: resolvedKey,
    description: generatePersonaPrompt(config),
  };
}

export function getSupportedPersonaNames(): string[] {
  return getAvailablePersonas();
}
