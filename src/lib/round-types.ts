import type { AnswerFormat, InterviewRoundType } from "@/lib/interview-rounds";
import type { CodeLanguage } from "@/lib/code-answer";
import type { TileColor } from "@/lib/tile-colors";
import {
  Code2,
  Heart,
  Lightbulb,
  MessageSquare,
  Network,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The single description of what each round type *is*.
 *
 * Before this existed, that knowledge was spread across four
 * `Record<InterviewRoundType, …>` maps in two files, plus four independent
 * hand-rolled answers to "is this a technical round?":
 *
 *   - `decision-engine.ts`      a Set
 *   - `response-analyzer.ts`    an || chain
 *   - `report/[id]/page.tsx`    another || chain
 *   - `coach/model-answer`      a switch fallthrough
 *
 * All four happened to agree. Nothing made them agree, and a fifth site — the
 * setup wizard's code-editor toggle — did not: it gated on `practiceMode`
 * instead of round type, so a behavioural round could be given a code editor.
 * The candidate's source was then graded against the STAR rubric while
 * simultaneously being told to judge complexity and edge cases.
 *
 * The proof this shape was needed: `hr` was added as a round type and is still
 * half-configured — label, rubric and playbook, but no default duration, no
 * default focus, no drill questions — because there was no one place where the
 * gap would show. A `Record` over `InterviewRoundType` makes an incomplete
 * entry a compile error.
 *
 * Adding a round type is one object literal in this file.
 */

/**
 * Which scoring and questioning model a round type belongs to.
 *
 * Named because it is now load-bearing outside this file: the loop brief uses
 * it to decide whether one round's questions are worth carrying into the next.
 * Two technical rounds can land on the same problem; a technical round and an
 * HR round cannot.
 */
export type RoundFamily = "behavioural" | "technical";

export interface RoundTypeSpec {
  label: string;
  /**
   * Identity, not decoration. The wizard was one accent colour throughout, so
   * three rounds in a loop rendered as three identical white cards and the type
   * picker changed nothing you could see. An icon and an accent make the type
   * legible at a glance — and because the colour maps to *which kind of round
   * this is*, it still answers a question rather than ornamenting.
   *
   * `accent` indexes `TILE_COLORS`, the same per-section system the dashboard
   * already uses for its page headers.
   */
  icon: LucideIcon;
  accent: TileColor;
  /** Shown under the type picker, and sent to the analyzer as the rubric. */
  rubric: string;
  /**
   * The interviewer's *first* question of this round, as an instruction.
   *
   * Every round used to open with one hardcoded line ending "…and ask if
   * they're ready to begin", so a technical round and an HR round started
   * identically, and the candidate's first turn was always the word "yes" —
   * which `TRIVIAL_ANSWER` skips, so the exchange was never scored. A real
   * interview opens on a question that belongs to the round it is.
   *
   * Phrased as an instruction rather than a verbatim line so the persona still
   * chooses its own words; see `buildOpeningInstruction`.
   */
  opening: string;
  /**
   * The same round's first question when it is *not* the first round of the day.
   *
   * The shipped default loop is screening → behavioral, whose cold openings are
   * "introduce themselves" and "tell you about themselves" — the same question
   * twice, by two people who are meant to be colleagues. The loop brief could
   * not fix that on its own: it tells the interviewer what happened earlier,
   * but `buildOpeningInstruction` emitted `opening` unconditionally, so the
   * model was told to ask for a background it had just been briefed on.
   *
   * The three behavioural types get a genuinely different question. The three
   * technical types keep their cold-open instruction and gain only a bridging
   * clause — a system design round has to state the system whether it is round
   * one or round four.
   */
  continuationOpening: string;
  /**
   * Which scoring and questioning model applies. Drives the analyzer's schema
   * branch and which decision-engine strategy ladder runs.
   */
  family: RoundFamily;
  /** Interviewer playbook id, pinned rather than tag-matched. */
  playbookId: string;
  /** Tags used to select the per-turn playbook layer. */
  tags: string[];
  /**
   * What the round can offer. One flag today — the point is that capabilities
   * are declared per type rather than inferred at each call site.
   *
   * Note what is deliberately absent: this app never executes code (see
   * `code-input.tsx`, "Reviewed by the interviewer, not executed"), has no
   * whiteboard, no SQL runtime and no screen share. Flags for those would
   * describe a product that does not exist.
   */
  supports: {
    codeEditor: boolean;
  };
  defaults: {
    durationMinutes: number;
    focus: string;
    /** Only meaningful when `supports.codeEditor`. */
    language?: CodeLanguage;
  };
}

export const ROUND_TYPE_SPECS: Record<InterviewRoundType, RoundTypeSpec> = {
  screening: {
    icon: MessageSquare,
    accent: "teal",
    label: "Intro / screening",
    rubric: "Clarity, motivation, fit, concision",
    family: "behavioural",
    opening:
      "Ask them to introduce themselves and what drew them to this role.",
    continuationOpening:
      "Skip the background tour — a colleague already took it. Ask what specifically drew them to this role, and why now.",
    playbookId: "screening-fit",
    tags: ["screening", "motivation"],
    supports: { codeEditor: false },
    defaults: {
      durationMinutes: 15,
      focus: "Background, motivation, and role fit.",
    },
  },
  behavioral: {
    icon: Users,
    accent: "purple",
    label: "Behavioral",
    rubric: "STAR, clarity, specificity",
    family: "behavioural",
    opening:
      "Ask them to tell you about themselves and how they got to where they are now.",
    continuationOpening:
      "Skip the career walkthrough — a colleague already has it. Pick one thing the earlier rounds left unproven and ask for a specific story about a time they faced it.",
    playbookId: "behavioral-star",
    tags: ["behavioral", "star"],
    supports: { codeEditor: false },
    defaults: {
      durationMinutes: 20,
      focus: "STAR stories, ownership, conflict, and ambiguity.",
    },
  },
  hr: {
    icon: Heart,
    accent: "pink",
    label: "HR / People",
    rubric: "Motivation, values fit, logistics, questions for us",
    family: "behavioural",
    opening:
      "Ask them to walk you through their background and what they are looking for in their next role.",
    continuationOpening:
      "Skip the background walkthrough — a colleague already covered it. Ask what they are looking for in their next role and what would make them say yes to this one.",
    playbookId: "hr-people",
    tags: ["hr", "motivation"],
    supports: { codeEditor: false },
    // These did not exist before — `hr` fell through to the generic 15-minute
    // default and "What you want this round to focus on."
    defaults: {
      durationMinutes: 20,
      focus: "Motivation, values fit, logistics, and your questions for them.",
    },
  },
  technical_swe: {
    icon: Code2,
    accent: "blue",
    label: "Technical SWE",
    rubric:
      "Problem framing, approach, correctness, complexity, communication, edge cases, code quality",
    family: "technical",
    opening:
      "State the coding problem you want them to solve, concretely and in full, then invite them to think out loud before writing any code.",
    continuationOpening:
      "State the coding problem you want them to solve, concretely and in full, then invite them to think out loud before writing any code. Say plainly that this round is hands-on, since the earlier ones were conversation.",
    playbookId: "technical-framing",
    tags: ["technical", "framing", "vague"],
    // The only type that gets an editor. Its rubric asks for correctness,
    // complexity and code quality, which a chat box cannot reasonably accept.
    supports: { codeEditor: true },
    defaults: {
      durationMinutes: 25,
      focus: "Algorithmic problem solving and communication.",
      language: "python",
    },
  },
  system_design: {
    icon: Network,
    accent: "indigo",
    label: "System design",
    rubric:
      "Requirements, architecture, depth, tradeoffs, scalability, communication",
    family: "technical",
    opening:
      "State the system you want them to design and the scale it has to handle, then ask how they would approach it.",
    continuationOpening:
      "State the system you want them to design and the scale it has to handle, then ask how they would approach it. Pick one adjacent to work the earlier rounds surfaced, so the round tests design and not domain luck.",
    playbookId: "system-design",
    tags: ["system_design", "architecture", "technical"],
    // Deliberately prose. Without execution or a diagram surface, an editor
    // here invites pseudocode into a box graded on requirements and tradeoffs.
    supports: { codeEditor: false },
    defaults: {
      durationMinutes: 30,
      focus: "Requirements, architecture, and tradeoffs.",
    },
  },
  case: {
    icon: Lightbulb,
    accent: "orange",
    label: "Case / problem solving",
    rubric: "Problem framing, structure, tradeoffs, depth, communication",
    family: "technical",
    opening:
      "Set out the business situation concretely — the company, the market, and the decision on the table — then ask how they would structure their thinking.",
    continuationOpening:
      "Set out the business situation concretely — the company, the market, and the decision on the table — then ask how they would structure their thinking. Anchor it to a domain the earlier rounds show they know.",
    playbookId: "technical-framing",
    tags: ["case", "framing", "vague"],
    supports: { codeEditor: false },
    defaults: {
      durationMinutes: 25,
      focus: "Problem framing, prioritisation, metrics, and tradeoffs.",
    },
  },
};

export function roundTypeSpec(type: InterviewRoundType): RoundTypeSpec {
  return ROUND_TYPE_SPECS[type];
}

/**
 * Whether a round is scored on the technical rubric rather than STAR.
 *
 * Replaces four separate implementations of this question.
 */
export function isTechnicalRound(
  type: InterviewRoundType | undefined,
): boolean {
  return type ? ROUND_TYPE_SPECS[type].family === "technical" : false;
}

/** Whether a round type can offer a code editor at all. */
export function supportsCodeEditor(
  type: InterviewRoundType | undefined,
): boolean {
  return type ? ROUND_TYPE_SPECS[type].supports.codeEditor : false;
}

/**
 * The answer format a round type uses when the user has not overridden it.
 * Voice is handled by the caller, since it is a session concern, not a type one.
 */
export function defaultAnswerFormat(type: InterviewRoundType): AnswerFormat {
  return ROUND_TYPE_SPECS[type].supports.codeEditor ? "code" : "prose";
}

/**
 * The rubric as discrete criteria rather than one comma-joined sentence.
 *
 * "Scored on requirements, architecture, depth, tradeoffs…" rendered as a grey
 * fragment; the same words as chips are scannable and give the card structure
 * instead of prose.
 */
export function rubricCriteria(type: InterviewRoundType): string[] {
  return ROUND_TYPE_SPECS[type].rubric
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
