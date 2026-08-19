import type { DrillQuestion } from "../categories";

/**
 * The first call: fifteen minutes, usually not with an engineer.
 *
 * Absorbs the two old `hr` questions that were really screening questions —
 * "what are you looking for" and the compensation opener — so the two topics
 * stop overlapping.
 */
export const RECRUITER_SCREEN_QUESTIONS: DrillQuestion[] = [
  {
    id: "scr-1",
    category: "recruiter_screen",
    prompt: "Walk me through your background in two minutes.",
  },
  {
    id: "scr-2",
    category: "recruiter_screen",
    prompt: "Why are you interested in this role specifically?",
  },
  {
    id: "scr-3",
    category: "recruiter_screen",
    prompt: "What do you know about what we build?",
  },
  {
    id: "scr-4",
    category: "recruiter_screen",
    prompt: "What are you looking for in your next position?",
  },
  {
    id: "scr-5",
    category: "recruiter_screen",
    prompt: "Why are you leaving your current role?",
  },
  {
    id: "scr-6",
    category: "recruiter_screen",
    prompt:
      "What's your greatest technical strength? Give me an example of it in use.",
  },
  {
    id: "scr-7",
    category: "recruiter_screen",
    prompt: "Talk me through the most relevant thing on your CV for this role.",
  },
  {
    id: "scr-8",
    category: "recruiter_screen",
    prompt: "What kind of work do you want to be doing in two years?",
  },
  {
    id: "scr-9",
    category: "recruiter_screen",
    prompt: "Which part of the stack do you most want to work on, and why?",
  },
  {
    id: "scr-10",
    category: "recruiter_screen",
    prompt:
      "What are your compensation expectations, and how flexible are they?",
  },
  {
    id: "scr-11",
    category: "recruiter_screen",
    prompt: "When could you start, and what's your notice period?",
  },
  {
    id: "scr-12",
    category: "recruiter_screen",
    prompt: "Are you interviewing elsewhere? Where are you in those processes?",
  },
  {
    id: "scr-13",
    category: "recruiter_screen",
    prompt:
      "Tell me about a project on your CV in ninety seconds — assume I'm not technical.",
  },
  {
    id: "scr-14",
    category: "recruiter_screen",
    prompt:
      "What's a technology you've picked up recently, and what made you pick it up?",
  },
  {
    id: "scr-15",
    category: "recruiter_screen",
    prompt: "Why should we move you to the technical round?",
  },
  {
    id: "scr-16",
    category: "recruiter_screen",
    prompt: "What would you want to be true about your first six months here?",
  },
  {
    id: "scr-17",
    category: "recruiter_screen",
    prompt:
      "Is there anything on your CV you'd want to explain before we go further?",
  },
  {
    id: "scr-18",
    category: "recruiter_screen",
    prompt: "How do you decide which roles to apply to?",
  },
  {
    id: "scr-19",
    category: "recruiter_screen",
    prompt: "What size of company and team suits how you work?",
  },
  {
    id: "scr-20",
    category: "recruiter_screen",
    prompt: "What questions do you have about the role before we go further?",
  },
];
