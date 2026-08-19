import { ROUND_TYPES, type InterviewRoundType } from "@/lib/interview-rounds";
import { ROUND_TYPE_SPECS } from "@/lib/round-types";

export interface InterviewerPlaybook {
  id: string;
  tags: string[];
  content: string;
}

const PLAYBOOKS: InterviewerPlaybook[] = [
  {
    id: "one-question",
    tags: ["general", "pace"],
    content:
      "Ask exactly one question per turn. Keep replies short and conversational.",
  },
  {
    id: "vague-answer",
    tags: ["vague", "specificity", "pushback"],
    content:
      "If the answer is vague, ask for one concrete example, metric, or decision the candidate personally owned.",
  },
  {
    id: "behavioral-star",
    tags: ["behavioral", "star"],
    content:
      "For behavioral answers, probe missing STAR parts: situation, task, action, and measurable result.",
  },
  {
    id: "technical-framing",
    tags: ["technical", "framing"],
    content:
      "For technical rounds, make the candidate clarify constraints before solving. Ask about edge cases and complexity.",
  },
  {
    id: "system-design",
    tags: ["system_design", "architecture"],
    content:
      "For system design, start with requirements and users, then high-level architecture, then deepen one component and tradeoffs.",
  },
  {
    id: "screening-fit",
    tags: ["screening", "motivation"],
    content:
      "For screening rounds, keep it concise. Test motivation, role fit, and communication clarity.",
  },
  {
    id: "cs-fundamentals",
    tags: ["cs_fundamentals", "definitions"],
    content:
      "For CS fundamentals rounds, never accept the definition alone. Once they have defined it, ask for a concrete case where it mattered, and then ask when the alternative would be the better choice. A candidate who can only recite has not shown they understand it.",
  },
  {
    id: "hr-people",
    tags: ["hr", "motivation"],
    content:
      "For HR rounds, cover what a People partner actually asks: why this role and this company, how they work with others, notice period and timing, and what they are looking for next. Leave room near the end for their questions about the team, and answer them in character.",
  },
  {
    id: "acknowledge-strength",
    tags: ["positive", "warmth"],
    content:
      "When the candidate does something well, acknowledge it briefly before the next question.",
  },
];

const ROUND_TAGS: Record<InterviewRoundType, string[]> = Object.fromEntries(
  ROUND_TYPES.map((type) => [type, ROUND_TYPE_SPECS[type].tags]),
) as Record<InterviewRoundType, string[]>;

/**
 * The playbook a round type always gets, independent of what the candidate just
 * said. Stable for the whole round, so it belongs in the cacheable prompt
 * prefix rather than the per-turn layer.
 *
 * Named explicitly rather than matched by tag. Tag matching returned the first
 * entry in array order, which is not the best entry: `hr` matched
 * `screening-fit` before `hr-people`, `system_design` matched
 * `technical-framing` before `system-design`, and `technical_swe` matched the
 * generic `vague-answer` — so three round types silently got the wrong
 * guidance and their own playbook was never reachable.
 */
const ROUND_PLAYBOOK_IDS: Record<InterviewRoundType, string> =
  Object.fromEntries(
    ROUND_TYPES.map((type) => [type, ROUND_TYPE_SPECS[type].playbookId]),
  ) as Record<InterviewRoundType, string>;

export function selectRoundPlaybook(
  roundType: InterviewRoundType | undefined,
): InterviewerPlaybook | null {
  if (!roundType) return null;
  const id = ROUND_PLAYBOOK_IDS[roundType];
  return PLAYBOOKS.find((playbook) => playbook.id === id) ?? null;
}

export function selectInterviewerPlaybooks(input: {
  roundType?: InterviewRoundType;
  userMessage?: string;
  max?: number;
}): InterviewerPlaybook[] {
  const max = input.max ?? 2;
  const tags = new Set<string>(["general"]);
  if (input.roundType) {
    for (const tag of ROUND_TAGS[input.roundType]) {
      tags.add(tag);
    }
  }

  const message = (input.userMessage ?? "").toLowerCase();
  if (message.includes("i think") || message.includes("maybe")) {
    tags.add("vague");
  }
  if (message.length < 80) {
    tags.add("specificity");
  }

  const ranked = PLAYBOOKS.map((playbook) => {
    const score = playbook.tags.reduce(
      (sum, tag) => sum + (tags.has(tag) ? 1 : 0),
      0,
    );
    return { playbook, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected = ranked.slice(0, max).map((entry) => entry.playbook);
  if (selected.length > 0) return selected;

  return PLAYBOOKS.filter((playbook) => playbook.id === "one-question").slice(
    0,
    1,
  );
}

export function formatPlaybooksForPrompt(
  playbooks: InterviewerPlaybook[],
): string {
  if (playbooks.length === 0) return "";
  return [
    "Relevant interviewer behavior for this turn:",
    ...playbooks.map((playbook) => `- ${playbook.content}`),
  ].join("\n");
}
