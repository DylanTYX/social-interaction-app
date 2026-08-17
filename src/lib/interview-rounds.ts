import type { PracticeMode } from "@/lib/interview-setup";
import {
  defaultAnswerFormat,
  ROUND_TYPE_SPECS,
  supportsCodeEditor,
} from "@/lib/round-types";

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
 * The round type decides whether an editor is possible; the mode decides only
 * what the round *opens* with.
 *
 * A stored `answerFormat: "code"` is **ignored on a type that does not support
 * an editor**. It used to win outright, which is how a behavioural round could
 * end up with one: the wizard offered the toggle (it gated on practice mode,
 * not round type), and once written the override beat the default. Saved loops
 * and localStorage payloads still carry those values, so refusing them here is
 * what actually fixes it — which is why that guard runs first.
 *
 * Voice used to return `"prose"` before either check, so a voice technical
 * round was a spoken discussion scored on `correctness`, `complexity` and
 * `codeQuality` — the same "the rubric asks for something the interface cannot
 * accept" problem `AnswerFormat` was introduced to fix, surviving on the voice
 * path. It now only sets the *default*: a voice round opens on discussion,
 * because the interviewer states the problem and invites thinking out loud, and
 * the editor is one tap away from there.
 */
export function resolveAnswerFormat(
  round:
    | Pick<InterviewRoundConfig, "type" | "practiceMode" | "answerFormat">
    | undefined,
): AnswerFormat {
  if (!round || !supportsCodeEditor(round.type)) return "prose";
  if (round.answerFormat) return round.answerFormat;
  if (round.practiceMode === "voice") return "prose";
  return defaultAnswerFormat(round.type);
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

/**
 * Views over `ROUND_TYPE_SPECS`. Kept as exported records because a dozen call
 * sites index them directly; they are no longer a second place to edit.
 */
export const ROUND_TYPE_LABELS: Record<InterviewRoundType, string> =
  Object.fromEntries(
    ROUND_TYPES.map((type) => [type, ROUND_TYPE_SPECS[type].label]),
  ) as Record<InterviewRoundType, string>;

export const ROUND_RUBRIC_LABELS: Record<InterviewRoundType, string> =
  Object.fromEntries(
    ROUND_TYPES.map((type) => [type, ROUND_TYPE_SPECS[type].rubric]),
  ) as Record<InterviewRoundType, string>;

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
    currentRoundIndex: Math.min(loop.currentRoundIndex, nextRounds.length - 1),
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
  const isPm =
    lower.includes("product manager") || lower.includes("product management");
  const isDesign =
    lower.includes("designer") || lower.includes("design system");
  const isData =
    lower.includes("data scientist") ||
    lower.includes("data analyst") ||
    lower.includes("machine learning");
  const isMarketing = lower.includes("marketing");
  const isSales =
    lower.includes("sales") || lower.includes("account executive");

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

export function getCurrentRound(
  loop: InterviewLoopConfig,
): InterviewRoundConfig {
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

/**
 * Re-apply a round type's defaults when the user switches type.
 *
 * Changing the type used to patch the type alone, so a round switched to System
 * design kept 15 minutes and "What you want this round to focus on." — even
 * though the codebase already knew system design means 30 minutes and
 * "Requirements, architecture, and tradeoffs". Those defaults existed, trapped
 * inside template literals.
 *
 * Only values still equal to the *previous* type's default are replaced, so
 * anything the user typed survives the change. `answerFormat` is cleared
 * outright: an explicit choice made for one type says nothing about another,
 * and leaving it set is how a code override followed a round to a type with no
 * editor.
 */
export function applyRoundType(
  round: InterviewRoundConfig,
  nextType: InterviewRoundType,
): InterviewRoundConfig {
  const previous = ROUND_TYPE_SPECS[round.type].defaults;
  const next = ROUND_TYPE_SPECS[nextType].defaults;

  return {
    ...round,
    type: nextType,
    durationMinutes:
      round.durationMinutes === previous.durationMinutes
        ? next.durationMinutes
        : round.durationMinutes,
    focus: isUneditedFocus(round.focus, previous.focus)
      ? next.focus
      : round.focus,
    answerFormat: undefined,
  };
}

/**
 * A focus string counts as unedited if it still matches the previous type's
 * default, or one of the generic placeholders a blank round is created with.
 */
function isUneditedFocus(current: string, previousDefault: string): boolean {
  const generic = [
    previousDefault,
    "What you want this round to focus on.",
    "Practice this interview round.",
    "A focused interview practice round using the selected scenario.",
  ];
  return generic.some((value) => value.trim() === current.trim());
}
