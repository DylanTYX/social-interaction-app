import type { DrillQuestion } from "../categories";

/**
 * Language fundamentals — the questions that follow "what do you write in?".
 *
 * Phrased to be answerable in whichever language the candidate names, or with
 * the language stated as part of the answer. A question that only makes sense
 * in Java would be a coin flip on whether the drill is usable at all.
 */
export const PROGRAMMING_QUESTIONS: DrillQuestion[] = [
  {
    id: "prog-1",
    category: "programming",
    prompt:
      "Explain the difference between the stack and the heap, and which of your variables live where.",
  },
  {
    id: "prog-2",
    category: "programming",
    prompt:
      "What's the difference between passing by value and passing by reference? Give an example where it bit you.",
  },
  {
    id: "prog-3",
    category: "programming",
    prompt:
      "Explain mutability. Why do languages bother having immutable types at all?",
  },
  {
    id: "prog-4",
    category: "programming",
    prompt: "What is a closure, and what problem does it solve?",
  },
  {
    id: "prog-5",
    category: "programming",
    prompt:
      "Explain how garbage collection works in the language you use, and what it costs you.",
  },
  {
    id: "prog-6",
    category: "programming",
    prompt:
      "What's the difference between a checked and an unchecked exception, and when should you catch either?",
  },
  {
    id: "prog-7",
    category: "programming",
    prompt:
      "Explain generics. What problem did they solve that came before them?",
  },
  {
    id: "prog-8",
    category: "programming",
    prompt:
      "What's the difference between an iterator and a generator, and when does the difference matter?",
  },
  {
    id: "prog-9",
    category: "programming",
    prompt:
      "Explain shallow versus deep copy, and a bug caused by confusing them.",
  },
  {
    id: "prog-10",
    category: "programming",
    prompt:
      "What is a race condition? Talk me through one you could write in ten lines.",
  },
  {
    id: "prog-11",
    category: "programming",
    prompt: "Explain the difference between concurrency and parallelism.",
  },
  {
    id: "prog-12",
    category: "programming",
    prompt:
      "What does `static` mean in the language you use, and what does it cost you?",
  },
  {
    id: "prog-13",
    category: "programming",
    prompt:
      "Walk me through what happens when you call a function — what actually goes on the stack?",
  },
  {
    id: "prog-14",
    category: "programming",
    prompt:
      "Explain the difference between compile time and runtime, using an error of each kind.",
  },
  {
    id: "prog-15",
    category: "programming",
    prompt:
      "What's the difference between an array and a linked list at the memory level, and why does that affect speed?",
  },
  {
    id: "prog-16",
    category: "programming",
    prompt:
      "Explain what a memory leak looks like in a garbage-collected language — surely that's impossible?",
  },
  {
    id: "prog-17",
    category: "programming",
    prompt:
      "What is recursion costing you that iteration isn't? When would you rewrite one as the other?",
  },
  {
    id: "prog-18",
    category: "programming",
    prompt: "Explain async/await. What is it actually doing underneath?",
  },
  {
    id: "prog-19",
    category: "programming",
    prompt:
      "When would you choose a functional style over an imperative one in production code?",
  },
  {
    id: "prog-20",
    category: "programming",
    prompt:
      "What makes code readable? Talk me through something you refactored purely for readability.",
  },
];
