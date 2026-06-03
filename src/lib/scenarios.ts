import { Wand2, type LucideIcon } from "lucide-react";

/**
 * Scenarios used to be a fixed list of six situations (QBR, conflict, etc.).
 * That was too narrow for end-to-end interview practice, so we now treat
 * every session's scenario as a free-form brief the user writes themselves.
 *
 * The shape below stays around because old sessions (and the chat/voice
 * pages) still call `getScenarioByValue` to render a title and description.
 * For new sessions, `scenarioValue` is always `CUSTOM_SCENARIO_VALUE` and
 * `customScenarioBrief` carries the user's free-form text.
 */

export const CUSTOM_SCENARIO_VALUE = "custom";

export interface ScenarioOption {
  value: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const CUSTOM_SCENARIO_OPTION: ScenarioOption = {
  value: CUSTOM_SCENARIO_VALUE,
  title: "Your interview brief",
  description:
    "Describe what you're preparing for in your own words — the interviewer adapts to your brief.",
  icon: Wand2,
};

/**
 * Quick-start chips shown next to the brief textarea. They only pre-fill the
 * input — they do NOT lock the user into a fixed scenario.
 */
export interface BriefQuickStart {
  id: string;
  label: string;
  template: string;
}

export const BRIEF_QUICK_STARTS: BriefQuickStart[] = [
  {
    id: "behavioral",
    label: "Behavioral / STAR",
    template:
      "I want to practice behavioral interview questions using the STAR format. Common topics: leadership, conflict, ambiguity, and ownership.",
  },
  {
    id: "full-loop",
    label: "Full job interview",
    template:
      "I'm preparing for an end-to-end interview for a [role] at a [company type]. I expect a mix of background, behavioral, and role-specific questions.",
  },
  {
    id: "negotiation",
    label: "Negotiation",
    template:
      "I want to rehearse a negotiation conversation — pushing back on scope, asking for a raise, or handling a difficult stakeholder.",
  },
  {
    id: "presentation",
    label: "Stakeholder presentation",
    template:
      "I'm presenting [topic] to senior stakeholders. Help me handle tough questions, pushback, and clarifying drills.",
  },
  {
    id: "intro",
    label: "Recruiter screen",
    template:
      "Recruiter screening call for a [role] role. Test motivation, role fit, and a quick walk through my background.",
  },
];

/**
 * Legacy lookup: old sessions stored hardcoded ids like "qbr" or "conflict".
 * We keep titles for them so historic reports still display nicely.
 */
const LEGACY_SCENARIO_TITLES: Record<string, { title: string; description: string }> = {
  qbr: {
    title: "Quarterly Business Review",
    description:
      "Present and discuss quarterly performance metrics with stakeholders.",
  },
  conflict: {
    title: "Conflict Resolution",
    description:
      "Address and resolve team conflicts with empathy and assertiveness.",
  },
  "client-negotiation": {
    title: "Client Negotiation",
    description: "Negotiate project scope and pricing with international clients.",
  },
  feedback: {
    title: "Team Feedback Session",
    description: "Deliver constructive feedback to team members.",
  },
  presentation: {
    title: "Product Presentation",
    description: "Present new product features to cross-functional stakeholders.",
  },
  "salary-negotiation": {
    title: "Salary Negotiation",
    description: "Negotiate compensation and benefits professionally.",
  },
  "intro-screening": {
    title: "Intro / screening call",
    description:
      "Background, motivation, and fit questions from a recruiter.",
  },
  "behavioral-star": {
    title: "Behavioral (STAR)",
    description: "Behavioral questions using the STAR format.",
  },
  "case-light": {
    title: "Light case / problem-solving",
    description:
      "Estimation, product reasoning, or simple business problem out loud.",
  },
  "why-this-role": {
    title: "Why this company & role",
    description: "Articulate motivation, fit, and research.",
  },
};

export function getScenarioByValue(
  value: string,
  customBrief?: string,
): ScenarioOption {
  if (value === CUSTOM_SCENARIO_VALUE) {
    const brief = customBrief?.trim() ?? "";
    const title =
      brief.length > 0
        ? brief.length > 56
          ? `${brief.slice(0, 56)}…`
          : brief
        : CUSTOM_SCENARIO_OPTION.title;
    return {
      ...CUSTOM_SCENARIO_OPTION,
      title,
      description:
        brief.length > 0 ? brief : CUSTOM_SCENARIO_OPTION.description,
    };
  }

  const legacy = LEGACY_SCENARIO_TITLES[value];
  if (legacy) {
    return {
      value,
      title: legacy.title,
      description: legacy.description,
      icon: Wand2,
    };
  }

  return {
    value,
    title: value,
    description: "Practice session.",
    icon: Wand2,
  };
}

export function resolveScenarioForLaunch(setup: {
  scenarioValue: string;
  customScenarioBrief?: string;
}): { value: string; title: string; description: string } {
  const scenario = getScenarioByValue(
    setup.scenarioValue,
    setup.customScenarioBrief,
  );
  return {
    value: scenario.value,
    title: scenario.title,
    description: scenario.description,
  };
}
