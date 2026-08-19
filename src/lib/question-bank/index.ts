import type { InterviewRoundType } from "@/lib/interview-rounds";
import {
  DRILL_CATEGORIES,
  type DrillCategory,
  type DrillCategoryMeta,
  type DrillQuestion,
} from "./categories";

import { BEHAVIOURAL_QUESTIONS } from "./questions/behavioural";
import { RECRUITER_SCREEN_QUESTIONS } from "./questions/recruiter-screen";
import { HR_QUESTIONS } from "./questions/hr";
import { DSA_QUESTIONS } from "./questions/dsa";
import { PROGRAMMING_QUESTIONS } from "./questions/programming";
import { TESTING_QUESTIONS } from "./questions/testing";
import { OOP_QUESTIONS } from "./questions/oop";
import { DATABASE_QUESTIONS } from "./questions/databases";
import { OS_QUESTIONS } from "./questions/operating-systems";
import { NETWORK_QUESTIONS } from "./questions/networks";
import { SECURITY_QUESTIONS } from "./questions/security";
import { SYSTEM_DESIGN_QUESTIONS } from "./questions/system-design";
import { AI_ML_QUESTIONS } from "./questions/ai-ml";
import { CLOUD_DEVOPS_QUESTIONS } from "./questions/cloud-devops";
import { WEB_FRONTEND_QUESTIONS } from "./questions/web-frontend";

/**
 * The drill question bank.
 *
 * A directory rather than a file since it passed three hundred questions. The
 * public surface is unchanged and this module is still `@/lib/question-bank`,
 * so every existing import resolves here without edit.
 *
 * Where this is used, and where it is not:
 *
 *   - **Quick drills** — the bank *is* the question. `getQuestionsForCategory`
 *     then `pickRandom`, and the chosen category's `roundType` selects the
 *     rubric the answer is coached against.
 *   - **The setup wizard** — `exampleQuestionForRoundType` renders one question
 *     under each round card, to show what that round type is like.
 *   - **The interview simulation** — *not used at all.* Questions there are
 *     written by the model, grounded in retrieval over the candidate's job
 *     description and steered by the previous turn. A drill is fixed on
 *     purpose; an interview is adaptive on purpose. See `docs/DRILLS.md`.
 */
export const DRILL_QUESTIONS: DrillQuestion[] = [
  ...BEHAVIOURAL_QUESTIONS,
  ...RECRUITER_SCREEN_QUESTIONS,
  ...HR_QUESTIONS,
  ...DSA_QUESTIONS,
  ...PROGRAMMING_QUESTIONS,
  ...TESTING_QUESTIONS,
  ...OOP_QUESTIONS,
  ...DATABASE_QUESTIONS,
  ...OS_QUESTIONS,
  ...NETWORK_QUESTIONS,
  ...SECURITY_QUESTIONS,
  ...SYSTEM_DESIGN_QUESTIONS,
  ...AI_ML_QUESTIONS,
  ...CLOUD_DEVOPS_QUESTIONS,
  ...WEB_FRONTEND_QUESTIONS,
];

export {
  DRILL_CATEGORIES,
  DRILL_GROUPS,
  type DrillCategory,
  type DrillCategoryMeta,
  type DrillGroup,
  type DrillQuestion,
} from "./categories";

export function getQuestionsForCategory(
  category: DrillCategory | "all",
): DrillQuestion[] {
  if (category === "all") return DRILL_QUESTIONS;
  return DRILL_QUESTIONS.filter((q) => q.category === category);
}

export function getCategoryMeta(category: DrillCategory): DrillCategoryMeta {
  return DRILL_CATEGORIES.find((c) => c.id === category) ?? DRILL_CATEGORIES[0];
}

/**
 * A real question of the kind this round type asks.
 *
 * The bank is keyed by drill topic and several topics map onto one round type —
 * eight of them share `cs_fundamentals` — so this walks the mapping that
 * `DRILL_CATEGORIES` already encodes rather than assuming topic and round type
 * are the same thing.
 *
 * Used by the setup wizard: choosing a round type used to change only a grey
 * rubric sentence, which made the most consequential decision in the flow feel
 * abstract. Showing something the interviewer might actually ask answers the
 * question a candidate really has.
 *
 * `seed` keeps the choice stable for a given round rather than reshuffling on
 * every keystroke — this renders inside a controlled form.
 */
export function exampleQuestionForRoundType(
  roundType: InterviewRoundType,
  seed = 0,
): string | null {
  const categories = DRILL_CATEGORIES.filter(
    (category) => category.roundType === roundType,
  ).map((category) => category.id);

  const pool = DRILL_QUESTIONS.filter((question) =>
    categories.includes(question.category),
  );

  if (pool.length === 0) return null;
  return pool[Math.abs(seed) % pool.length].prompt;
}
