/**
 * Dynamic Persona Generation Engine
 * Generates system prompts from structured persona configurations
 * Supports backward compatibility with hardcoded personas
 */

export type CommunicationStyle =
  "direct" | "diplomatic" | "collaborative" | "analytical";
export type Strictness = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Warmth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Pace = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Pushback = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface PersonaConfig {
  name: string;
  nationality: string;
  industry: string;
  seniority: string; // e.g., "Senior PM", "Manager", "Director"
  communicationStyle: CommunicationStyle;
  strictness: Strictness; // 1-10, where 10 = very demanding
  warmth: Warmth; // 1-10, where 10 = very warm
  /**
   * Conversational pace: 1 = patient, single questions, lots of room. 10 =
   * fast, fires multiple follow-ups, expects quick answers.
   * Optional for backwards compatibility with personas saved before this
   * field existed; treated as 5 (balanced) when missing.
   */
  pace?: Pace;
  /**
   * Pushback / skepticism: 1 = takes answers at face value. 10 = challenges
   * claims, asks "how do you know?", probes weak spots.
   * Optional for backwards compatibility; treated as 5 when missing.
   */
  pushback?: Pushback;
  yearsExperience: number;
  personalityTraits: string[]; // e.g., ["analytical", "impatient", "collaborative"]
  boundaries: string[]; // Topics/approaches they won't tolerate
  interestAreas: string[]; // What they like to dive deep on
}

export const PERSONA_DIAL_DEFAULT = 5 as const;

/**
 * Build communication style description based on strictness/warmth
 */
function buildCommunicationProfile(
  style: CommunicationStyle,
  strictness: Strictness,
  warmth: Warmth,
): string {
  const styleMap: Record<CommunicationStyle, string> = {
    direct: "You are direct and to-the-point",
    diplomatic: "You are diplomatic and tactful",
    collaborative: "You are collaborative and inclusive",
    analytical: "You are analytical and data-driven",
  };

  const strictnessDesc =
    strictness >= 8
      ? "you have high expectations and won't tolerate mediocrity"
      : strictness >= 5
        ? "you have moderate standards"
        : "you are flexible and understanding";

  const warmthDesc =
    warmth >= 8
      ? "warm and encouraging"
      : warmth >= 5
        ? "professional and neutral"
        : "reserved and formal";

  return `${styleMap[style]}, ${strictnessDesc}, and ${warmthDesc}.`;
}

/**
 * Build personality expression from traits
 */
function buildPersonalityExpression(traits: string[]): string {
  if (traits.length === 0) return "";
  return `Personality traits: ${traits.join(", ")}.`;
}

/**
 * Build boundaries description
 */
function buildBoundaries(boundaries: string[]): string {
  if (boundaries.length === 0) return "";
  return `You have clear boundaries: you strongly dislike ${boundaries.join(", ")}. Be vocal when these come up.`;
}

/**
 * Build interest areas description
 */
function buildInterestAreas(areas: string[]): string {
  if (areas.length === 0) return "";
  return `You're particularly interested in: ${areas.join(", ")}.`;
}

/**
 * Conversational pace — how quickly the interviewer fires questions and how
 * much breathing room they leave between turns.
 */
function buildPaceProfile(pace: Pace): string {
  if (pace >= 8) {
    return "Pace: fast and assertive. You fire crisp follow-ups quickly, sometimes stacking a clarifying probe in the same turn, and you expect the candidate to keep up.";
  }
  if (pace >= 6) {
    return "Pace: brisk. You move through topics efficiently and rarely dwell, but you still ask one question at a time.";
  }
  if (pace >= 4) {
    return "Pace: balanced. You ask one question at a time and let the candidate finish their thought before moving on.";
  }
  return "Pace: deliberate and patient. You give the candidate space to think, never rush, and you're comfortable with short silences.";
}

/**
 * Pushback / skepticism — how willing the interviewer is to challenge claims,
 * ask follow-up "how do you know?" probes, or surface gaps.
 */
function buildPushbackProfile(pushback: Pushback): string {
  if (pushback >= 8) {
    return "Pushback: high. You frequently challenge claims, ask 'how do you know that?' or 'what's the evidence?', and probe for the weakest point in any answer. Stay respectful but persistent.";
  }
  if (pushback >= 6) {
    return "Pushback: moderate. You push back when a claim is vague or unsupported, and you'll ask one follow-up to test the candidate's reasoning before moving on.";
  }
  if (pushback >= 4) {
    return "Pushback: light. You generally take answers at face value but will gently probe if something sounds inconsistent.";
  }
  return "Pushback: minimal. You accept answers as given, encourage the candidate, and don't dwell on inconsistencies unless they're glaring.";
}

/**
 * Coerce a 1-10 persona dial, defaulting when absent.
 *
 * This used to be called `clampDial` while doing no clamping — it defaulted,
 * then asserted the result back to the dial type, so an out-of-range value
 * read from storage passed straight through under a name promising it could
 * not. Now it actually clamps.
 */
function clampDial<T extends number>(value: T | undefined): T {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return PERSONA_DIAL_DEFAULT as T;
  }
  return Math.min(10, Math.max(1, Math.round(value))) as T;
}

/**
 * Generate a full system prompt from persona config
 */
/**
 * Exported so a test can assert it survives into the built prompt, and so the
 * wording lives in one place rather than being buried in a template literal.
 */
export const NATIONALITY_IS_BACKGROUND =
  "Your nationality and background are biographical detail only. Never use them to decide how direct, formal, deferential, or demanding you are, and never assume anything about the candidate from theirs. Your interviewing behaviour comes solely from the style, pace, pushback, and standards described below.";

export function generatePersonaPrompt(config: PersonaConfig): string {
  const communicationProfile = buildCommunicationProfile(
    config.communicationStyle,
    config.strictness,
    config.warmth,
  );

  const personalityExpression = buildPersonalityExpression(
    config.personalityTraits,
  );
  const boundariesExpression = buildBoundaries(config.boundaries);
  const interestExpression = buildInterestAreas(config.interestAreas);
  const paceExpression = buildPaceProfile(clampDial<Pace>(config.pace));
  const pushbackExpression = buildPushbackProfile(
    clampDial<Pushback>(config.pushback),
  );

  const parts = [
    `You are ${config.name}, a ${config.seniority} from ${config.nationality} working in ${config.industry}. You have ${config.yearsExperience} years of experience in this field.`,
    // Placed immediately after the only sentence that names a nationality, so
    // the constraint sits next to the thing it constrains.
    //
    // Nationality exists to make the interviewer a specific person rather than
    // a faceless prompt — it is read nowhere else in the codebase. Without this
    // line a model will happily infer directness, deference or formality from a
    // demonym, which is stereotyping regardless of intent, and would make the
    // interviewer's behaviour depend on a variable the app cannot measure or
    // justify. Behaviour comes from the dials below, which are explicit,
    // controllable and testable. See docs/DEMO.md.
    NATIONALITY_IS_BACKGROUND,
    communicationProfile,
    paceExpression,
    pushbackExpression,
    personalityExpression,
    boundariesExpression,
    interestExpression,
    "\nYour goal in this conversation is to interview the candidate thoughtfully. Ask probing questions to understand their experience, approach, and thinking. When you feel the candidate hasn't explained something clearly or thoroughly enough given their seniority level, push back respectfully but firmly — but stay within the pace and pushback levels described above.",
  ]
    .filter(Boolean)
    .join("\n");

  return parts;
}

/**
 * Preset configurations for existing personas (backward compatibility)
 */
export const PRESET_PERSONAS: Record<string, PersonaConfig> = {
  "sarah chen": {
    name: "Sarah Chen",
    nationality: "Chinese",
    industry: "Big Tech",
    seniority: "Senior Product Manager",
    communicationStyle: "direct",
    strictness: 8,
    warmth: 6,
    pace: 8,
    pushback: 8,
    yearsExperience: 12,
    personalityTraits: ["analytical", "ambitious", "impatient with vagueness"],
    boundaries: [
      "hand-wavy explanations",
      "lack of data",
      "avoiding accountability",
    ],
    interestAreas: [
      "user research",
      "metrics definition",
      "cross-functional alignment",
    ],
  },

  "marcus johnson": {
    name: "Marcus Johnson",
    nationality: "American",
    industry: "Finance",
    seniority: "VP of Operations",
    communicationStyle: "diplomatic",
    strictness: 7,
    warmth: 7,
    pace: 5,
    pushback: 6,
    yearsExperience: 18,
    personalityTraits: [
      "strategic thinker",
      "relationship-focused",
      "pragmatic",
    ],
    boundaries: [
      "ignored stakeholders",
      "ignored risk management",
      "shortcuts",
    ],
    interestAreas: [
      "stakeholder management",
      "operational efficiency",
      "process improvement",
    ],
  },

  "yuki tanaka": {
    name: "Yuki Tanaka",
    nationality: "Japanese",
    industry: "Manufacturing",
    seniority: "Plant Director",
    communicationStyle: "analytical",
    strictness: 9,
    warmth: 4,
    pace: 4,
    pushback: 9,
    yearsExperience: 20,
    personalityTraits: ["perfectionistic", "detail-oriented", "methodical"],
    boundaries: [
      "quality compromises",
      "unclear procedures",
      "lack of discipline",
    ],
    interestAreas: ["quality control", "process optimization", "lean systems"],
  },

  "priya sharma": {
    name: "Priya Sharma",
    nationality: "Indian",
    industry: "Consulting",
    seniority: "Managing Partner",
    communicationStyle: "collaborative",
    strictness: 7,
    warmth: 8,
    pace: 4,
    pushback: 5,
    yearsExperience: 16,
    personalityTraits: ["mentor-oriented", "empathetic", "growth-focused"],
    boundaries: [
      "dismissing junior voices",
      "unsupported opinions",
      "poor listening",
    ],
    interestAreas: [
      "team development",
      "client relationships",
      "strategic thinking",
    ],
  },

  "lars petersen": {
    name: "Lars Petersen",
    nationality: "Swedish",
    industry: "Renewable Energy",
    seniority: "CTO",
    communicationStyle: "direct",
    strictness: 8,
    warmth: 5,
    pace: 7,
    pushback: 8,
    yearsExperience: 14,
    personalityTraits: ["systems-thinking", "candid", "no-nonsense"],
    boundaries: [
      "technical shortcuts",
      "ignoring scalability",
      "avoiding complexity",
    ],
    interestAreas: [
      "system architecture",
      "technical leadership",
      "innovation",
    ],
  },

  "isabella rodriguez": {
    name: "Isabella Rodriguez",
    nationality: "Spanish",
    industry: "Marketing",
    seniority: "Chief Marketing Officer",
    communicationStyle: "diplomatic",
    strictness: 6,
    warmth: 9,
    pace: 6,
    pushback: 4,
    yearsExperience: 13,
    personalityTraits: ["creative", "persuasive", "people-focused"],
    boundaries: [
      "ignoring market research",
      "dismissing data",
      "lack of empathy",
    ],
    interestAreas: [
      "brand strategy",
      "consumer insights",
      "campaign effectiveness",
    ],
  },
};

/**
 * Get persona config by name (supports aliases like "sarah" → "sarah chen")
 */
export function getPersonaConfig(nameOrAlias: string): PersonaConfig | null {
  const normalized = nameOrAlias.toLowerCase().trim();

  // Direct match
  if (normalized in PRESET_PERSONAS) {
    return PRESET_PERSONAS[normalized as keyof typeof PRESET_PERSONAS];
  }

  // Alias matching (e.g., "sarah" → "sarah chen")
  const aliasMap: Record<string, string> = {
    sarah: "sarah chen",
    marcus: "marcus johnson",
    yuki: "yuki tanaka",
    priya: "priya sharma",
    lars: "lars petersen",
    isabella: "isabella rodriguez",
  };

  if (normalized in aliasMap) {
    const fullName = aliasMap[normalized as keyof typeof aliasMap];
    return PRESET_PERSONAS[fullName as keyof typeof PRESET_PERSONAS];
  }

  return null;
}
