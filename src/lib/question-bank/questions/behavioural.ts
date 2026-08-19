import type { DrillQuestion } from "../categories";

/**
 * STAR stories plus the project and resume deep-dive.
 *
 * The research treats "Behavioral / Project / Resume discussion" as one area
 * and so does this: an interviewer moves between "tell me about a conflict" and
 * "why did you choose that database" without changing register. The five old
 * `leadership` questions about delegation and motivating underperformers are
 * gone — that is a manager's interview, not a new graduate's — but influence
 * without authority and disagreeing with a manager survive here, because those
 * are asked of everyone.
 */
export const BEHAVIOURAL_QUESTIONS: DrillQuestion[] = [
  {
    id: "beh-1",
    category: "behavioural",
    prompt:
      "Tell me about a time you took ownership of a problem that wasn't strictly yours.",
  },
  {
    id: "beh-2",
    category: "behavioural",
    prompt:
      "Describe a time you failed. What happened, and what did you actually change afterwards?",
  },
  {
    id: "beh-3",
    category: "behavioural",
    prompt: "Tell me about a conflict with a teammate and how it got resolved.",
  },
  {
    id: "beh-4",
    category: "behavioural",
    prompt:
      "Describe a situation where you had to make a decision with incomplete information.",
  },
  {
    id: "beh-5",
    category: "behavioural",
    prompt:
      "Tell me about a time you received difficult feedback. How did you respond?",
  },
  {
    id: "beh-6",
    category: "behavioural",
    prompt:
      "Describe the most challenging project you've worked on and your specific role in it.",
  },
  {
    id: "beh-7",
    category: "behavioural",
    prompt:
      "Tell me about a time you had to meet a tight deadline. What did you cut?",
  },
  {
    id: "beh-8",
    category: "behavioural",
    prompt: "Describe a time you disagreed with your manager. What did you do?",
  },
  {
    id: "beh-9",
    category: "behavioural",
    prompt:
      "Tell me about a time you influenced a technical decision without any authority to make it.",
  },
  {
    id: "beh-10",
    category: "behavioural",
    prompt:
      "Walk me through the project you're proudest of. What was yours, and what was the team's?",
  },
  {
    id: "beh-11",
    category: "behavioural",
    prompt:
      "Why did you choose that architecture for your final year project? What did you rule out?",
  },
  {
    id: "beh-12",
    category: "behavioural",
    prompt:
      "Why that language and framework? Talk me through the tradeoff you made.",
  },
  {
    id: "beh-13",
    category: "behavioural",
    prompt:
      "Tell me about a bug that took you far too long to find. How did you eventually find it?",
  },
  {
    id: "beh-14",
    category: "behavioural",
    prompt:
      "What would you change about your last project if you started it again tomorrow?",
  },
  {
    id: "beh-15",
    category: "behavioural",
    prompt:
      "Describe a time you had to learn a technology quickly. How did you go about it?",
  },
  {
    id: "beh-16",
    category: "behavioural",
    prompt:
      "Tell me about a time you disagreed with a code review comment. How did you handle it?",
  },
  {
    id: "beh-17",
    category: "behavioural",
    prompt:
      "Describe a time you shipped something you weren't happy with. Why did you ship it?",
  },
  {
    id: "beh-18",
    category: "behavioural",
    prompt:
      "Tell me about a time you had to work with someone whose style was very different from yours.",
  },
  {
    id: "beh-19",
    category: "behavioural",
    prompt:
      "Describe a time you spotted a problem nobody else had noticed. What did you do about it?",
  },
  {
    id: "beh-20",
    category: "behavioural",
    prompt:
      "Walk me through how you divided the work on a group project, and what went wrong with that split.",
  },
];
