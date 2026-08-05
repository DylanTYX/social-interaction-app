import type { PracticeMode } from "@/lib/interview-setup";

export const ROUND_TYPES = [
  "behavioral",
  "technical_swe",
  "system_design",
  "case",
  "screening",
  "hr",
] as const;

export type InterviewRoundType = (typeof ROUND_TYPES)[number];

/**
 * How the candidate composes an answer for a round.
 *
 * `technical_swe` rounds were scored on `codeQuality`, `correctness` and
 * `complexity` while the candidate typed prose into a chat box — the rubric
 * asked for something the interface could not accept. `code` swaps the input
 * for a real editor and sends the source with its language.
 */
export type AnswerFormat = "prose" | "code";

export interface InterviewRoundConfig {
  id: string;
  title: string;
  type: InterviewRoundType;
  durationMinutes: number;
  practiceMode: PracticeMode;
  focus: string;
  /** Defaults to `code` for technical_swe, `prose` everywhere else. */
  answerFormat?: AnswerFormat;
  /**
   * Persona library entry to run this round. Real loops put a recruiter, then
   * engineers, then a hiring manager in front of you; unset means inherit the
   * session's default interviewer.
   */
  personaLibraryId?: string;
}

/**
 * Voice rounds cannot use an editor, so the mode wins over the round type.
 */
export function resolveAnswerFormat(
  round: Pick<InterviewRoundConfig, "type" | "practiceMode" | "answerFormat">
    | undefined,
): AnswerFormat {
  if (!round || round.practiceMode === "voice") return "prose";
  if (round.answerFormat) return round.answerFormat;
  return round.type === "technical_swe" ? "code" : "prose";
}

export interface InterviewLoopConfig {
  enabled: boolean;
  templateId: string;
  breakMinutes: number;
  currentRoundIndex: number;
  rounds: InterviewRoundConfig[];
}

export interface InterviewLoopTemplate {
  id: string;
  title: string;
  description: string;
  rounds: InterviewRoundConfig[];
}

export const ROUND_TYPE_LABELS: Record<InterviewRoundType, string> = {
  behavioral: "Behavioral",
  technical_swe: "Technical SWE",
  system_design: "System design",
  case: "Case / problem solving",
  screening: "Intro / screening",
  hr: "HR / People",
};

export const ROUND_RUBRIC_LABELS: Record<InterviewRoundType, string> = {
  behavioral: "STAR, clarity, specificity",
  technical_swe:
    "Problem framing, approach, correctness, complexity, communication, edge cases, code quality",
  system_design:
    "Requirements, architecture, depth, tradeoffs, scalability, communication",
  case: "Problem framing, structure, tradeoffs, depth, communication",
  screening: "Clarity, motivation, fit, concision",
  hr: "Motivation, values fit, logistics, questions for us",
};

export const SINGLE_ROUND: InterviewRoundConfig = {
  id: "single-behavioral",
  title: "Practice round",
  type: "behavioral",
  durationMinutes: 15,
  practiceMode: "text",
  focus: "A focused interview practice round using the selected scenario.",
};

/**
 * Loop templates were dropped in favour of role-agnostic round primitives.
 * Users now compose any loop themselves — single round, two rounds, or six.
 * The two templates below are just sensible starting points.
 */
const CUSTOM_LOOP_DEFAULT_ROUNDS: InterviewRoundConfig[] = [
  {
    id: "round-1",
    title: "Screening / intro",
    type: "screening",
    durationMinutes: 15,
    practiceMode: "text",
    focus: "Background, motivation, and role fit.",
  },
  {
    id: "round-2",
    title: "Behavioral",
    type: "behavioral",
    durationMinutes: 20,
    practiceMode: "text",
    focus: "STAR stories, ownership, conflict, and ambiguity.",
  },
];

export const INTERVIEW_LOOP_TEMPLATES: InterviewLoopTemplate[] = [
  {
    id: "single",
    title: "Single round",
    description: "One focused practice session — the simplest setup.",
    rounds: [SINGLE_ROUND],
  },
  {
    id: "custom",
    title: "Custom loop",
    description:
      "Build your own multi-round interview. Add and edit rounds for any role.",
    rounds: CUSTOM_LOOP_DEFAULT_ROUNDS,
  },
];

export function createDefaultInterviewLoop(): InterviewLoopConfig {
  return {
    enabled: false,
    templateId: "single",
    breakMinutes: 5,
    currentRoundIndex: 0,
    rounds: [SINGLE_ROUND],
  };
}

export function createLoopFromTemplate(
  templateId: string,
  practiceMode: PracticeMode,
): InterviewLoopConfig {
  const template =
    INTERVIEW_LOOP_TEMPLATES.find((item) => item.id === templateId) ??
    INTERVIEW_LOOP_TEMPLATES[0];
  const rounds = template.rounds.map((round, index) => ({
    ...round,
    id: `${template.id}-round-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    practiceMode,
  }));
  return {
    enabled: template.id !== "single",
    templateId: template.id,
    breakMinutes: 5,
    currentRoundIndex: 0,
    rounds,
  };
}

function createBlankRound(
  index: number,
  practiceMode: PracticeMode,
): InterviewRoundConfig {
  return {
    id: `round-${Date.now().toString(36)}-${index}`,
    title: `Round ${index + 1}`,
    type: "behavioral",
    durationMinutes: 15,
    practiceMode,
    focus: "What you want this round to focus on.",
  };
}

export function appendRoundToLoop(
  loop: InterviewLoopConfig,
  practiceMode: PracticeMode,
): InterviewLoopConfig {
  const nextRounds = [
    ...loop.rounds,
    createBlankRound(loop.rounds.length, practiceMode),
  ];
  return {
    ...loop,
    enabled: nextRounds.length > 1,
    templateId: "custom",
    rounds: nextRounds,
  };
}

export function removeRoundFromLoop(
  loop: InterviewLoopConfig,
  index: number,
): InterviewLoopConfig {
  if (loop.rounds.length <= 1) return loop;
  const nextRounds = loop.rounds.filter((_, idx) => idx !== index);
  return {
    ...loop,
    enabled: nextRounds.length > 1,
    templateId: nextRounds.length > 1 ? "custom" : "single",
    currentRoundIndex: Math.min(
      loop.currentRoundIndex,
      nextRounds.length - 1,
    ),
    rounds: nextRounds,
  };
}

/**
 * Heuristic loop suggestion based on a job description's keywords. Returns
 * a custom loop, not a fixed preset, so the user can still edit every round.
 */
export function suggestLoopFromJobDescription(
  text: string,
  practiceMode: PracticeMode,
): InterviewLoopConfig {
  const lower = text.toLowerCase();
  const rounds: InterviewRoundConfig[] = [];
  const push = (round: Omit<InterviewRoundConfig, "id" | "practiceMode">) =>
    rounds.push({
      ...round,
      id: `suggested-${rounds.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
      practiceMode,
    });

  push({
    title: "Recruiter screen",
    type: "screening",
    durationMinutes: 15,
    focus: "Background, motivation, and role fit.",
  });

  const isSwe =
    lower.includes("software engineer") ||
    lower.includes("backend") ||
    lower.includes("frontend") ||
    lower.includes("full stack") ||
    lower.includes("developer");
  const isPm = lower.includes("product manager") || lower.includes("product management");
  const isDesign = lower.includes("designer") || lower.includes("design system");
  const isData =
    lower.includes("data scientist") ||
    lower.includes("data analyst") ||
    lower.includes("machine learning");
  const isMarketing = lower.includes("marketing");
  const isSales = lower.includes("sales") || lower.includes("account executive");

  if (isSwe) {
    push({
      title: "Technical 1",
      type: "technical_swe",
      durationMinutes: 25,
      focus: "Algorithmic problem solving and communication.",
    });
    push({
      title: "System design",
      type: "system_design",
      durationMinutes: 30,
      focus: "Requirements, architecture, and tradeoffs.",
    });
  } else if (isPm) {
    push({
      title: "Product case",
      type: "case",
      durationMinutes: 25,
      focus: "Problem framing, prioritization, metrics, and tradeoffs.",
    });
  } else if (isDesign || isData || isMarketing || isSales) {
    push({
      title: "Role-specific case",
      type: "case",
      durationMinutes: 25,
      focus: "Walk through a role-relevant problem out loud.",
    });
  }

  push({
    title: "Behavioral",
    type: "behavioral",
    durationMinutes: 20,
    focus: "Leadership, conflict, ownership, and STAR structure.",
  });

  return {
    enabled: rounds.length > 1,
    templateId: "custom",
    breakMinutes: 5,
    currentRoundIndex: 0,
    rounds,
  };
}

export function normalizeInterviewLoop(
  input: Partial<InterviewLoopConfig> | undefined,
  practiceMode: PracticeMode,
): InterviewLoopConfig {
  const defaults = createDefaultInterviewLoop();
  const rounds =
    Array.isArray(input?.rounds) && input.rounds.length > 0
      ? input.rounds.map((round, index) => ({
          id: typeof round.id === "string" ? round.id : `round-${index + 1}`,
          title:
            typeof round.title === "string" && round.title.trim()
              ? round.title
              : `Round ${index + 1}`,
          type: isRoundType(round.type) ? round.type : "behavioral",
          durationMinutes:
            typeof round.durationMinutes === "number"
              ? Math.max(5, Math.min(90, round.durationMinutes))
              : 15,
          practiceMode:
            round.practiceMode === "voice" || round.practiceMode === "text"
              ? round.practiceMode
              : practiceMode,
          focus:
            typeof round.focus === "string" && round.focus.trim()
              ? round.focus
              : "Practice this interview round.",
          // Must be carried through. Every read path normalizes — localStorage
          // load, and the server launch meta — so dropping it here silently
          // discarded the setup wizard's answer-format choice and left
          // `resolveAnswerFormat` falling back to the round type alone.
          answerFormat:
            round.answerFormat === "code" || round.answerFormat === "prose"
              ? round.answerFormat
              : undefined,
          personaLibraryId:
            typeof round.personaLibraryId === "string" && round.personaLibraryId
              ? round.personaLibraryId
              : undefined,
        }))
      : defaults.rounds.map((round) => ({ ...round, practiceMode }));

  return {
    enabled: Boolean(input?.enabled) && rounds.length > 1,
    templateId:
      typeof input?.templateId === "string" ? input.templateId : "single",
    breakMinutes:
      typeof input?.breakMinutes === "number"
        ? Math.max(0, Math.min(30, input.breakMinutes))
        : defaults.breakMinutes,
    currentRoundIndex:
      typeof input?.currentRoundIndex === "number"
        ? Math.max(0, Math.min(rounds.length - 1, input.currentRoundIndex))
        : 0,
    rounds,
  };
}

export function getCurrentRound(loop: InterviewLoopConfig): InterviewRoundConfig {
  return loop.rounds[loop.currentRoundIndex] ?? loop.rounds[0] ?? SINGLE_ROUND;
}

export function getNextRoundLoop(
  loop: InterviewLoopConfig,
): InterviewLoopConfig | null {
  if (!loop.enabled) return null;
  const nextIndex = loop.currentRoundIndex + 1;
  if (nextIndex >= loop.rounds.length) return null;
  return {
    ...loop,
    currentRoundIndex: nextIndex,
  };
}

export function buildRoundScenarioTitle(
  baseTitle: string,
  loop: InterviewLoopConfig,
): string {
  if (!loop.enabled) return baseTitle;
  const round = getCurrentRound(loop);
  return `Round ${loop.currentRoundIndex + 1}/${loop.rounds.length}: ${round.title}`;
}

export function buildRoundScenarioDescription(
  baseDescription: string,
  loop: InterviewLoopConfig,
): string {
  const round = getCurrentRound(loop);
  // `enabled` means "is a multi-round loop", so gating on it here left a
  // targeted single round's interviewer with no idea of its own type or rubric
  // — while the analyzer graded against that rubric regardless.
  const roundLine = loop.enabled
    ? `Interview loop round: ${round.title}.`
    : `Round: ${round.title}.`;

  return [
    baseDescription,
    "",
    roundLine,
    `Round type: ${ROUND_TYPE_LABELS[round.type]}.`,
    `Evaluation rubric: ${ROUND_RUBRIC_LABELS[round.type]}.`,
    `Round focus: ${round.focus}`,
  ].join("\n");
}

/**
 * Narrow an untrusted round type. Derived from `ROUND_TYPES` so the guard and
 * the union cannot drift — the hand-listed version would silently reject any
 * newly added type.
 */
export function isRoundType(value: unknown): value is InterviewRoundType {
  return (
    typeof value === "string" &&
    (ROUND_TYPES as readonly string[]).includes(value)
  );
}
