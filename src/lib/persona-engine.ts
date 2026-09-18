/**
 * Dynamic Persona Generation Engine
 * Generates system prompts from structured persona configurations
 */

export type CommunicationStyle =
  "direct" | "diplomatic" | "collaborative" | "analytical";
export type Strictness = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Warmth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Pace = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Pushback = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type ProbingDepth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Unpredictability = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Session-level questioning archetype — Layer 3 of the four-layer interviewer
 * (docs/INTERVIEWER.md). Each style is one prompt paragraph (how the
 * interviewer sounds) plus a move-weight profile in the decision engine (which
 * follow-up moves it favours). Six ship; the other research archetypes map
 * elsewhere — systematic is the engine itself, coaching is the drills coach,
 * executive is the HR round, expert/generalist is round type + JD.
 */
export const QUESTIONING_STYLES = [
  "supportive",
  "socratic",
  "deep_dive",
  "bar_raiser",
  "conversational",
  "stress",
] as const;

export type QuestioningStyle = (typeof QUESTIONING_STYLES)[number];

/**
 * Display copy for communication styles, beside the enum for the same reason
 * `QUESTIONING_STYLE_META` sits beside its own: the wizard had descriptions
 * ("Fast, candid, and to the point"), the library editor had bare labels, and
 * the two surfaces described one field two ways. The wizard's copy was the
 * better copy, so it is the copy.
 */
export const COMMUNICATION_STYLE_META: Record<
  CommunicationStyle,
  { label: string; description: string }
> = {
  direct: { label: "Direct", description: "Fast, candid, and to the point" },
  diplomatic: {
    label: "Diplomatic",
    description: "Tactful with measured pushback",
  },
  collaborative: {
    label: "Collaborative",
    description: "Warm, supportive, and exploratory",
  },
  analytical: {
    label: "Analytical",
    description: "Structured, evidence-driven, and precise",
  },
};

export const COMMUNICATION_STYLES = [
  "direct",
  "diplomatic",
  "collaborative",
  "analytical",
] as const satisfies readonly CommunicationStyle[];

/**
 * Display copy for the styles, declared beside the enum so the library card,
 * the library editor and the setup wizard cannot label one style three ways.
 * The blurbs are the honest one-line versions of the prompt paragraphs in
 * `buildQuestioningStyleProfile` below.
 */
export const QUESTIONING_STYLE_META: Record<
  QuestioningStyle,
  { label: string; blurb: string }
> = {
  conversational: {
    label: "Conversational",
    blurb: "Natural discussion; picks up your threads.",
  },
  supportive: {
    label: "Supportive",
    blurb: "Room to think; clarifies, never pressures.",
  },
  socratic: {
    label: "Socratic",
    blurb: "Answers with the next question — why, what if.",
  },
  deep_dive: {
    label: "Deep Dive",
    blurb: "One thread, drilled to the bottom.",
  },
  bar_raiser: {
    label: "Bar Raiser",
    blurb: "Evidence required for every claim.",
  },
  stress: {
    label: "Stress",
    blurb: "Pressure on, reassurance off. Opt-in.",
  },
};

export function isQuestioningStyle(value: unknown): value is QuestioningStyle {
  return (
    typeof value === "string" &&
    (QUESTIONING_STYLES as readonly string[]).includes(value)
  );
}

/**
 * Which voice this interviewer speaks with, within the accent their
 * nationality selects.
 *
 * Explicit rather than inferred. Guessing gender from the persona's first name
 * would be unreliable across exactly the international name set the randomiser
 * produces, and it would add a second inference-from-biography seam beside the
 * one `NATIONALITY_IS_BACKGROUND` exists to close. "unspecified" takes the
 * locale's first listed voice.
 *
 * Read only by `persona-voice.ts`, on the TTS path. It never reaches the
 * prompt — see the note on `nationality` below.
 */
export type PersonaVoiceGender = "female" | "male" | "unspecified";

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
  /**
   * How aggressively evidence-gap signals become probes: 1 = only the most
   * glaring gaps ("we did it" with no I anywhere), 10 = every unevidenced
   * claim gets its follow-up. Consumed by `chooseEvidenceProbe` in the
   * decision engine. Optional; treated as 5 when missing.
   */
  probingDepth?: ProbingDepth;
  /**
   * Curveball frequency: 1 = classic ladder interviewing, fully predictable;
   * 10 = pivots and hypothetical twists arrive whenever an answer is merely
   * fine. Consumed by `maybeCurveball` in the decision engine, which is
   * seeded — same session, same turn, same curveball — so unpredictability
   * to the candidate never means nondeterminism to the eval harness.
   * Optional; treated as 5 when missing.
   */
  unpredictability?: Unpredictability;
  /**
   * Layer 3: the questioning archetype. Optional; treated as
   * "conversational" (the realism default) when missing.
   */
  questioningStyle?: QuestioningStyle;
  /**
   * Optional for backwards compatibility with personas saved before accents
   * existed; treated as "unspecified" when missing.
   */
  voiceGender?: PersonaVoiceGender;
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
 * Words of acknowledgement this interviewer may spend before the question.
 *
 * Warmth's only prompt consumer was a three-band adjective, so 8, 9 and 10 read
 * identically. A word allowance is countable and has eight settings, which is
 * as many as this dial can honestly carry: the standing rules already forbid
 * praise, so warmth can lengthen the acknowledgement but never turn it into
 * approval.
 */
export function acknowledgementWords(warmth: number): number {
  const safe = Math.max(1, Math.min(10, Number.isFinite(warmth) ? warmth : 5));
  // Scaled from 1, not 2: the old curve rounded both 1 and 2 down to zero, so
  // the two coldest settings produced the same interviewer — the same defect
  // at the bottom of this dial that `unchallengedAllowed` fixes at the ends of
  // pushback. Eleven words at the top is a sentence, which is the most a rule
  // forbidding praise can honestly allow.
  return Math.round((safe - 1) * 1.2);
}

/**
 * The score this interviewer treats as good enough, on the analyzer's own 0-100
 * scale: 45 at strictness 1, 90 at strictness 10.
 *
 * The strongest of the strictness directives, because it is the only one that
 * is both continuous over all ten steps and *comparable to something the model
 * is already told*. The steering block states "Their last answer scored 80/100"
 * on every turn, so a bar of 85 and a bar of 60 are not two shades of adjective
 * — they put the same answer on opposite sides of a line the model can see.
 */
export function acceptanceBar(strictness: number): number {
  const safe = Math.max(1, Math.min(10, Number.isFinite(strictness) ? strictness : 5));
  return 40 + 5 * safe;
}

/** Concrete specifics an answer must carry before this interviewer moves on. */
export function specificsRequired(strictness: number): number {
  const safe = Number.isFinite(strictness) ? strictness : 5;
  return Math.max(1, Math.min(5, Math.round(safe / 2)));
}

/**
 * How many times this interviewer re-asks for a missing detail before moving on.
 *
 * Breaks at 2, 5 and 8, where `specificsRequired` breaks on the even numbers.
 * Two scales out of step give eight distinct settings between them where either
 * alone gives five — the same trick as the pushback rungs, and the reason
 * strictness no longer collapses 8, 9 and 10 into one interviewer.
 */
export function reAskAllowance(strictness: number): number {
  const safe = Math.max(1, Math.min(10, Number.isFinite(strictness) ? strictness : 5));
  if (safe >= 8) return 4;
  if (safe >= 5) return 3;
  if (safe >= 2) return 2;
  return 1;
}

/**
 * The bar for accepting an answer, and how the question is opened.
 *
 * Strictness and warmth reached the model only through one clause each inside
 * the personality sentence — three prose bands apiece, which is why moving
 * either slider from 8 to 9 changed nothing a candidate could see. These lines
 * add something countable: a number of specifics to insist on, and whether to
 * acknowledge before pressing. The dial's own value is stated too, so the model
 * has a continuous signal as well as a threshold.
 *
 * Deliberately additive — the personality sentence is unchanged, so nothing
 * about the interviewer's voice moves; this only makes the standard explicit.
 */
function buildStandardsProfile(strictness: number, warmth: number): string {
  const specifics = specificsRequired(strictness);
  const allowance = acknowledgementWords(warmth);
  const warmthDirective =
    allowance === 0
      ? "Do not acknowledge, thank or soften. Put the question directly."
      : `Before the question you may spend at most ${allowance} words acknowledging that they answered — no praise, no assessment.`;

  const reAsks = reAskAllowance(strictness);
  return [
    `Standards: strictness ${strictness}/10, warmth ${warmth}/10.`,
    `You consider an answer good enough at about ${acceptanceBar(strictness)} out of 100; below that you keep digging.`,
    `Accept an answer and move on only when it carries at least ${specifics} concrete specific${specifics === 1 ? "" : "s"} — a number, a date, a named person, system or tradeoff.`,
    `If it falls short, ask again for the missing detail, up to ${reAsks} time${reAsks === 1 ? "" : "s"} across the round, before you let it go.`,
    warmthDirective,
  ].join(" ");
}

/** Follow-ups on the same answer before this interviewer changes subject. */
export function followupsBeforeMoving(probingDepth: number): number {
  const safe = Math.max(1, Math.min(10, Number.isFinite(probingDepth) ? probingDepth : 5));
  // Divided by 2.2 rather than 2 so the steps fall between the probe gate's,
  // which move at 2, 3, 5, 6, 8 and 9. Halving put them on top of each other
  // and wasted the dial. Five is the ceiling because "stay on this answer for
  // a seventh follow-up" is not something a real interviewer does.
  return Math.max(1, Math.min(5, Math.round(safe / 2.2)));
}

/**
 * How hard the interviewer digs at a hedge — the dial's first prompt presence.
 *
 * Probing depth reached the model through nothing at all until now. Its only
 * consumer was `probeTierLimit` in the decision engine, which decides whether a
 * hedged phrase is worth quoting back; the interviewer itself was never told
 * that it was supposed to be a deep prober or a shallow one. That is a thin
 * place for what `INTERVIEWER.md` calls the control knob for the failure mode
 * this whole design exists to beat — default LLM interviewers deepen on 4.9% of
 * turns — so the dial now says so in words as well as deciding in code.
 *
 * The top of the scale is an absolute rather than one more number, because the
 * end of a dial should mean something a middle value cannot.
 */
function buildProbingProfile(probingDepth: number): string {
  const followups = followupsBeforeMoving(probingDepth);
  const absolute =
    probingDepth >= 10
      ? " Let nothing vague or unowned past you, however small."
      : "";

  // "before you choose to move on" is load-bearing, not padding. Without it
  // this line reads as a standing order to stay on the answer, and it then
  // contradicts the private notes whenever those call a topic pivot — which is
  // measurable: the pivot simply does not happen. The persona sets the
  // interviewer's own inclination; the notes outrank it.
  return `Probing depth: ${probingDepth}/10. When an answer leans on a vague or unowned phrase — "helped with", "we decided", "it went well" — ask about that phrase before you move on. Left to your own judgement, stay on the same answer for at least ${followups} follow-up${followups === 1 ? "" : "s"} before you choose to move on; if your private notes tell you to change subject, change subject.${absolute}`;
}

/**
 * Conversational pace — how quickly the interviewer fires questions and how
 * much breathing room they leave between turns.
 */
function buildPaceProfile(pace: Pace): string {
  const band =
    pace >= 8
      ? "Pace: fast and assertive. You fire crisp follow-ups quickly, sometimes stacking a clarifying probe in the same turn, and you expect the candidate to keep up."
      : pace >= 6
        ? "Pace: brisk. You move through topics efficiently and rarely dwell, but you still ask one question at a time."
        : pace >= 4
          ? "Pace: balanced. You ask one question at a time and let the candidate finish their thought before moving on."
          : "Pace: deliberate and patient. You give the candidate space to think, never rush, and you're comfortable with short silences.";

  // The one directive on any dial with ten genuinely distinct settings, and the
  // only one a reader can check by counting rather than by judgement. Four
  // prose bands cannot express ten steps; a budget can. Stays inside the
  // standing "1 to 4 sentences" rule at both ends (57 words down to 30).
  return `${band.replace(/^Pace: ([^.]+)\./, `Pace: $1 (${pace}/10).`)} Keep your next question to at most ${paceWordBudget(pace)} words.`;
}

/** Words allowed in one question at this pace: 57 at 1, 30 at 10. */
export function paceWordBudget(pace: number): number {
  const safe = Number.isFinite(pace) ? pace : 5;
  return 60 - 3 * Math.max(1, Math.min(10, Math.round(safe)));
}


/**
 * Pushback / skepticism — how willing the interviewer is to challenge claims,
 * ask follow-up "how do you know?" probes, or surface gaps.
 */
function buildPushbackProfile(pushback: Pushback): string {
  const band =
    pushback >= 8
      ? "Pushback: high. You frequently challenge claims, ask 'how do you know that?' or 'what's the evidence?', and probe for the weakest point in any answer. Stay respectful but persistent."
      : pushback >= 6
        ? "Pushback: moderate. You push back when a claim is vague or unsupported, and you'll ask one follow-up to test the candidate's reasoning before moving on."
        : pushback >= 4
          ? "Pushback: light. You generally take answers at face value but will gently probe if something sounds inconsistent."
          : "Pushback: minimal. You accept answers as given, encourage the candidate, and don't dwell on inconsistencies unless they're glaring.";

  // Phrased as one question throughout: the standing rules forbid stacking
  // questions, so a higher dial names more claims inside a single question
  // rather than asking more of them.
  const directive = PUSHBACK_DIRECTIVES[contestCount(pushback)];
  const allowed = unchallengedAllowed(pushback);
  const budget =
    allowed === 0
      ? "Across this round, let no unsupported claim pass without asking what backs it."
      : `Across this round, you may let about ${allowed} unsupported claim${allowed === 1 ? "" : "s"} pass without asking what backs ${allowed === 1 ? "it" : "them"}.`;

  return `${band.replace(/^Pushback: ([^.]+)\./, `Pushback: $1 (${pushback}/10).`)} ${directive} ${budget}`;
}

/**
 * Five rungs of challenge, deliberately offset from the four prose bands.
 *
 * Bands break at 4, 6 and 8; these break at 3, 5, 7 and 9. Two coarse scales
 * out of step resolve more finely than either alone — eight of the ten steps
 * become distinct — without claiming a granularity one question can't carry.
 * Every rung is one question, because the standing rules forbid stacking them.
 */
const PUSHBACK_DIRECTIVES = [
  "Take their account at face value this turn; do not contest a claim.",
  "Question a claim only where the answer is plainly inconsistent with itself.",
  "Build your question around one claim of theirs you are not yet convinced by.",
  "Name one claim of theirs you doubt and ask what evidence supports it.",
  "Name two claims of theirs you doubt, ask what evidence supports them, and say plainly that you are not convinced yet.",
] as const;

/**
 * Unsupported claims this interviewer lets pass in a round before challenging:
 * five at pushback 1, none at pushback 10.
 *
 * Added because the two extremes — where a dial should be most obviously itself
 * — were the two places it did nothing: 1 and 2 were identical, and so were 9
 * and 10. Every other pushback consumer breaks in the middle of the scale (the
 * prose bands at 4, 6 and 8; the challenge rungs at 3, 5, 7 and 9), so nothing
 * separated the ends. This breaks on the even numbers, which is exactly the
 * gap, and it says something a reader can check: at 10 the interviewer lets
 * nothing through.
 */
export function unchallengedAllowed(pushback: number): number {
  const safe = Math.max(1, Math.min(10, Number.isFinite(pushback) ? pushback : 5));
  return Math.max(0, Math.round((10 - safe) / 2));
}

/** Which rung of `PUSHBACK_DIRECTIVES` this dial setting reaches, 0 to 4. */
export function contestCount(pushback: number): number {
  const safe = Number.isFinite(pushback) ? pushback : 5;
  if (safe >= 9) return 4;
  if (safe >= 7) return 3;
  if (safe >= 5) return 2;
  if (safe >= 3) return 1;
  return 0;
}

/**
 * The questioning-style paragraph — how the archetype sounds.
 *
 * Voice only: the style's effect on which follow-up move gets chosen lives in
 * the decision engine's weights, so the same style changes both how the
 * interviewer speaks and what it does next, from one field.
 */
function buildQuestioningStyleProfile(style: QuestioningStyle): string {
  switch (style) {
    case "supportive":
      return "Questioning style: supportive. Give the candidate room to think, clarify the question if they misread it, and let them finish. Never hand over answers — you still probe, just without pressure.";
    case "socratic":
      return "Questioning style: Socratic. Rarely confirm whether an answer is right or wrong; respond with the next question — why, what assumption, what happens in the edge case — so the candidate's reasoning does the work.";
    case "deep_dive":
      return "Questioning style: deep dive. Pick one thread and drill it to the bottom — how, how it was measured, what the baseline was, what alternatives were considered, what they would do differently — before ever changing topic.";
    case "bar_raiser":
      return "Questioning style: bar raiser. Require concrete evidence for every claim before accepting it. Challenge assumptions, ask for the data behind assertions, and do not move on while an answer is still hand-waving.";
    case "conversational":
      return "Questioning style: conversational. Make it feel like a real discussion — pick up threads the candidate opens, transition naturally between topics, and keep the structure invisible.";
    case "stress":
      return "Questioning style: stress. Push back often, interrupt politely when an answer rambles, give little reassurance, and add pressure — but never become hostile or personal; the pressure is on the answers, not the person.";
  }
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
  const standardsExpression = buildStandardsProfile(
    clampDial<Strictness>(config.strictness),
    clampDial<Warmth>(config.warmth),
  );
  const probingExpression = buildProbingProfile(
    clampDial<ProbingDepth>(config.probingDepth),
  );
  const paceExpression = buildPaceProfile(clampDial<Pace>(config.pace));
  const pushbackExpression = buildPushbackProfile(
    clampDial<Pushback>(config.pushback),
  );
  const styleExpression = buildQuestioningStyleProfile(
    isQuestioningStyle(config.questioningStyle)
      ? config.questioningStyle
      : "conversational",
  );

  const parts = [
    // "a Plant Director from Japanese" — `nationality` holds a demonym
    // ("Japanese", "Spanish"), not a country, so `from X` was ungrammatical for
    // all six presets and every generated persona, on every turn. As an
    // adjective it reads correctly and, usefully, frames nationality as a
    // descriptor of the person rather than a place they act on behalf of.
    `You are ${config.name}, a ${config.nationality} ${config.seniority} working in ${config.industry}. You have ${config.yearsExperience} years of experience in this field.`,
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
    styleExpression,
    standardsExpression,
    probingExpression,
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
 * The built-in interviewers, seeded into each user's persona library.
 *
 * `voiceGender` is set on every preset, and it is authored, not inferred: these
 * are written characters, so choosing their voice is part of writing them. It
 * used to be absent on all six, and an absent preference takes the locale's
 * first voice — which made Marcus Johnson and Lars Petersen speak as women.
 */
export const PRESET_PERSONAS: Record<string, PersonaConfig> = {
  "sarah chen": {
    name: "Sarah Chen",
    nationality: "Chinese",
    voiceGender: "female",
    industry: "Big Tech",
    seniority: "Senior Product Manager",
    communicationStyle: "direct",
    strictness: 8,
    warmth: 6,
    pace: 8,
    pushback: 8,
    probingDepth: 8,
    unpredictability: 6,
    questioningStyle: "deep_dive",
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
    voiceGender: "male",
    industry: "Finance",
    seniority: "VP of Operations",
    communicationStyle: "diplomatic",
    strictness: 7,
    warmth: 7,
    pace: 5,
    pushback: 6,
    probingDepth: 6,
    unpredictability: 5,
    questioningStyle: "conversational",
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

  // Was Yuki Tanaka, Japanese. Japanese has no voice that speaks accented
  // English — every one auditioned rebuilt the words out of Japanese sounds —
  // so a Japanese preset could only ever speak neutral English. Replaced rather
  // than deleted, with every dial, trait and role unchanged: this is the strict
  // half of the demo's contrasting pair, and the numbers quoted from it
  // (7/10 against Isabella's 5/10) depend only on those. Existing libraries are
  // migrated by `RETIRED_PRESETS` in `db/personas.ts`.
  "aisyah rahman": {
    name: "Aisyah Rahman",
    nationality: "Singaporean",
    voiceGender: "female",
    industry: "Manufacturing",
    seniority: "Plant Director",
    communicationStyle: "analytical",
    strictness: 9,
    warmth: 4,
    pace: 4,
    pushback: 9,
    probingDepth: 9,
    unpredictability: 6,
    questioningStyle: "bar_raiser",
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
    voiceGender: "female",
    industry: "Consulting",
    seniority: "Managing Partner",
    communicationStyle: "collaborative",
    strictness: 7,
    warmth: 8,
    pace: 4,
    pushback: 5,
    probingDepth: 7,
    unpredictability: 4,
    questioningStyle: "socratic",
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
    voiceGender: "male",
    industry: "Renewable Energy",
    seniority: "CTO",
    communicationStyle: "direct",
    strictness: 8,
    warmth: 5,
    pace: 7,
    pushback: 8,
    probingDepth: 7,
    unpredictability: 8,
    questioningStyle: "stress",
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
    voiceGender: "female",
    industry: "Marketing",
    seniority: "Chief Marketing Officer",
    communicationStyle: "diplomatic",
    strictness: 6,
    warmth: 9,
    pace: 6,
    pushback: 4,
    probingDepth: 4,
    unpredictability: 3,
    questioningStyle: "supportive",
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
