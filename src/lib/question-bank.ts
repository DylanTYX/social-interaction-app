import type { InterviewRoundType } from "@/lib/interview-rounds";

export type DrillCategory =
  | "behavioral"
  | "leadership"
  | "technical_swe"
  | "system_design"
  | "screening"
  | "case";

export interface DrillCategoryMeta {
  id: DrillCategory;
  label: string;
  /** Round type used when asking the coach endpoint for feedback. */
  roundType: InterviewRoundType;
  blurb: string;
}

export const DRILL_CATEGORIES: DrillCategoryMeta[] = [
  {
    id: "behavioral",
    label: "Behavioral",
    roundType: "behavioral",
    blurb: "STAR stories: ownership, conflict, ambiguity, failure.",
  },
  {
    id: "leadership",
    label: "Leadership",
    roundType: "behavioral",
    blurb: "Influence, delegation, and tough people decisions.",
  },
  {
    id: "screening",
    label: "Recruiter screen",
    roundType: "screening",
    blurb: "Motivation, fit, and a crisp walk through your background.",
  },
  {
    id: "technical_swe",
    label: "Technical (SWE)",
    roundType: "technical_swe",
    blurb: "Approach, correctness, complexity, and communication.",
  },
  {
    id: "system_design",
    label: "System design",
    roundType: "system_design",
    blurb: "Requirements, architecture, tradeoffs, and scale.",
  },
  {
    id: "case",
    label: "Case / problem-solving",
    roundType: "case",
    blurb: "Structure, estimation, and reasoning out loud.",
  },
];

export interface DrillQuestion {
  id: string;
  category: DrillCategory;
  prompt: string;
}

export const DRILL_QUESTIONS: DrillQuestion[] = [
  // Behavioral
  { id: "b1", category: "behavioral", prompt: "Tell me about a time you took ownership of a problem that wasn't strictly yours." },
  { id: "b2", category: "behavioral", prompt: "Describe a time you failed. What happened and what did you learn?" },
  { id: "b3", category: "behavioral", prompt: "Tell me about a time you had a conflict with a coworker and how you resolved it." },
  { id: "b4", category: "behavioral", prompt: "Describe a situation where you had to make a decision with incomplete information." },
  { id: "b5", category: "behavioral", prompt: "Tell me about a time you received difficult feedback. How did you respond?" },
  { id: "b6", category: "behavioral", prompt: "Describe the most challenging project you've worked on and your specific role." },
  { id: "b7", category: "behavioral", prompt: "Tell me about a time you had to meet a tight deadline. How did you manage it?" },
  { id: "b8", category: "behavioral", prompt: "Describe a time you disagreed with your manager. What did you do?" },

  // Leadership
  { id: "l1", category: "leadership", prompt: "Tell me about a time you led a team through a difficult change." },
  { id: "l2", category: "leadership", prompt: "Describe a time you had to motivate an underperforming teammate." },
  { id: "l3", category: "leadership", prompt: "Tell me about a decision you made that was unpopular with your team." },
  { id: "l4", category: "leadership", prompt: "Describe how you've delegated work when you were overloaded." },
  { id: "l5", category: "leadership", prompt: "Tell me about a time you had to influence a decision without authority." },

  // Screening
  { id: "s1", category: "screening", prompt: "Walk me through your background in two minutes." },
  { id: "s2", category: "screening", prompt: "Why are you interested in this role specifically?" },
  { id: "s3", category: "screening", prompt: "What are you looking for in your next position?" },
  { id: "s4", category: "screening", prompt: "Why are you leaving your current role?" },
  { id: "s5", category: "screening", prompt: "What's your greatest professional strength, with an example?" },

  // Technical (SWE)
  { id: "t1", category: "technical_swe", prompt: "How would you find the first non-repeating character in a string? Talk through your approach and complexity." },
  { id: "t2", category: "technical_swe", prompt: "Explain the difference between a hash map and a balanced binary search tree, and when you'd choose each." },
  { id: "t3", category: "technical_swe", prompt: "How would you detect a cycle in a linked list? Walk me through it." },
  { id: "t4", category: "technical_swe", prompt: "Describe how you'd debug a production service that's intermittently returning 500s." },
  { id: "t5", category: "technical_swe", prompt: "What happens, end to end, when you type a URL into a browser and hit enter?" },

  // System design
  { id: "d1", category: "system_design", prompt: "Design a URL shortener. Start with the requirements and key tradeoffs." },
  { id: "d2", category: "system_design", prompt: "Design a news feed for a social app. How do you handle fan-out and scale?" },
  { id: "d3", category: "system_design", prompt: "Design a rate limiter for a public API. Walk through the approach." },
  { id: "d4", category: "system_design", prompt: "Design a chat application that supports millions of concurrent users." },

  // Case
  { id: "c1", category: "case", prompt: "How many electric vehicles will be sold in your country next year? Estimate out loud." },
  { id: "c2", category: "case", prompt: "A SaaS product's monthly churn just doubled. How do you investigate?" },
  { id: "c3", category: "case", prompt: "Our checkout conversion dropped 15% last week. Walk me through how you'd diagnose it." },
  { id: "c4", category: "case", prompt: "How would you decide whether to build or buy an internal analytics tool?" },
];

export function getQuestionsForCategory(
  category: DrillCategory | "all",
): DrillQuestion[] {
  if (category === "all") return DRILL_QUESTIONS;
  return DRILL_QUESTIONS.filter((q) => q.category === category);
}

export function getCategoryMeta(category: DrillCategory): DrillCategoryMeta {
  return (
    DRILL_CATEGORIES.find((c) => c.id === category) ?? DRILL_CATEGORIES[0]
  );
}
