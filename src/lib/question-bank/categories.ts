import type { InterviewRoundType } from "@/lib/interview-rounds";

/**
 * The drill topics, and the standard each is marked against.
 *
 * A topic is *what you practise*; `roundType` is *how the answer is graded* —
 * it selects `COACH_RUBRICS[roundType]`, which supplies the shape, signals and
 * failure modes the coach is given. The two are deliberately separate, and many
 * topics share one rubric: eight of the fifteen map to `cs_fundamentals`,
 * because "explain X and contrast it with Y" is one marking standard whatever
 * the subject matter is.
 *
 * Scoped to Computer Science roles. The list was derived by surveying CS2023's
 * seventeen knowledge areas, the interview topics Amazon and Microsoft publish,
 * and role-specific prep sources — roughly sixty candidate domains — then
 * keeping a domain only where (a) a rubric describes a good answer to it and
 * (b) a CS student plausibly interviews for it. `docs/DRILLS.md` carries the
 * full audit, including what was excluded and why.
 */

export type DrillCategory =
  | "behavioural"
  | "recruiter_screen"
  | "hr"
  | "dsa"
  | "programming"
  | "testing"
  | "oop"
  | "databases"
  | "operating_systems"
  | "networks"
  | "security"
  | "system_design"
  | "ai_ml"
  | "cloud_devops"
  | "web_frontend";

/**
 * The heading a topic appears under on the drills page.
 *
 * Fifteen chips in one wrapping row is a wall. Grouped, the row also says
 * something true: `core` is what every CS interview draws on, `specialisation`
 * is what only some roles ask. That is CS2023's own CS Core / KA Core split.
 */
export type DrillGroup = "behavioural" | "core" | "specialisation";

export const DRILL_GROUPS: { id: DrillGroup; label: string }[] = [
  { id: "behavioural", label: "Behavioural" },
  { id: "core", label: "Core Technical" },
  { id: "specialisation", label: "Specialisations" },
];

export interface DrillCategoryMeta {
  id: DrillCategory;
  /** Title Case: these are proper names of subjects, and they sit in a menu. */
  label: string;
  group: DrillGroup;
  /** Selects the coach rubric. Never assume it equals `id`. */
  roundType: InterviewRoundType;
  blurb: string;
}

export const DRILL_CATEGORIES: DrillCategoryMeta[] = [
  {
    id: "behavioural",
    label: "Behavioural",
    group: "behavioural",
    roundType: "behavioral",
    blurb: "STAR stories, and the projects on your CV in depth.",
  },
  {
    id: "recruiter_screen",
    label: "Recruiter Screen",
    group: "behavioural",
    roundType: "screening",
    blurb: "Motivation, fit, and a crisp walk through your background.",
  },
  {
    id: "hr",
    label: "HR & People",
    group: "behavioural",
    roundType: "hr",
    blurb: "Values, working style, logistics, and questions for them.",
  },

  {
    id: "dsa",
    label: "Data Structures & Algorithms",
    group: "core",
    roundType: "technical_swe",
    blurb: "Approach, correctness, complexity, and thinking out loud.",
  },
  {
    id: "programming",
    label: "Programming & Languages",
    group: "core",
    roundType: "technical_swe",
    blurb: "Language fundamentals, memory, and how your tools behave.",
  },
  {
    id: "testing",
    label: "Testing & Debugging",
    group: "core",
    roundType: "technical_swe",
    blurb: "Finding the cause, proving the fix, stopping the repeat.",
  },
  {
    id: "oop",
    label: "OOP & Software Design",
    group: "core",
    roundType: "cs_fundamentals",
    blurb: "Pillars, SOLID, patterns, and designing a class properly.",
  },
  {
    id: "databases",
    label: "Databases & SQL",
    group: "core",
    roundType: "cs_fundamentals",
    blurb: "Queries, indexes, transactions, and where data lives.",
  },
  {
    id: "operating_systems",
    label: "Operating Systems",
    group: "core",
    roundType: "cs_fundamentals",
    blurb: "Processes, memory, scheduling, concurrency, deadlock.",
  },
  {
    id: "networks",
    label: "Computer Networks",
    group: "core",
    roundType: "cs_fundamentals",
    blurb: "TCP/IP, HTTP, DNS, and what happens between machines.",
  },
  {
    id: "security",
    label: "Security",
    group: "core",
    roundType: "cs_fundamentals",
    blurb: "Auth, cryptography, TLS, and the common web attacks.",
  },
  {
    id: "system_design",
    label: "System Design",
    group: "core",
    roundType: "system_design",
    blurb: "Requirements, architecture, tradeoffs, and scale.",
  },

  {
    id: "ai_ml",
    label: "AI & Machine Learning",
    group: "specialisation",
    roundType: "cs_fundamentals",
    blurb: "Models, evaluation, overfitting, and how LLMs fit in.",
  },
  {
    id: "cloud_devops",
    label: "Cloud & DevOps",
    group: "specialisation",
    roundType: "cs_fundamentals",
    blurb: "Containers, orchestration, pipelines, and observability.",
  },
  {
    id: "web_frontend",
    label: "Web & Frontend",
    group: "specialisation",
    roundType: "cs_fundamentals",
    blurb: "The browser, JavaScript semantics, rendering, and CORS.",
  },
];

export interface DrillQuestion {
  id: string;
  category: DrillCategory;
  prompt: string;
}
