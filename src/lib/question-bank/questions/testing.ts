import type { DrillQuestion } from "../categories";

/**
 * Testing, debugging and engineering practice — research area 9.
 *
 * Marked against `technical_swe`, whose signals already include "handles the
 * edge cases the problem implies" and whose failure modes include "no edge
 * cases considered at all". The fit is close enough that this does not need a
 * rubric of its own.
 */
export const TESTING_QUESTIONS: DrillQuestion[] = [
  {
    id: "test-1",
    category: "testing",
    prompt:
      "Describe how you'd debug a production service that's intermittently returning 500s.",
  },
  {
    id: "test-2",
    category: "testing",
    prompt:
      "What's the difference between a unit test and an integration test, and how do you decide which to write?",
  },
  {
    id: "test-3",
    category: "testing",
    prompt: "How do you decide what's worth testing and what isn't?",
  },
  {
    id: "test-4",
    category: "testing",
    prompt: "Walk me through how you'd track down a memory leak.",
  },
  {
    id: "test-5",
    category: "testing",
    prompt: "What is a flaky test, and what do you do about one?",
  },
  {
    id: "test-6",
    category: "testing",
    prompt:
      "Explain test-driven development. Do you actually work that way, and why or why not?",
  },
  {
    id: "test-7",
    category: "testing",
    prompt: "A bug only reproduces in production. How do you approach it?",
  },
  {
    id: "test-8",
    category: "testing",
    prompt: "What's a regression test, and when would you write one?",
  },
  {
    id: "test-9",
    category: "testing",
    prompt: "Explain mocking. When does a mock make a test worse?",
  },
  {
    id: "test-10",
    category: "testing",
    prompt:
      "How do you find the edge cases for a function you've just written?",
  },
  {
    id: "test-11",
    category: "testing",
    prompt:
      "What does high code coverage actually tell you, and what does it not?",
  },
  {
    id: "test-12",
    category: "testing",
    prompt:
      "Walk me through your process for a code review. What do you look for first?",
  },
  {
    id: "test-13",
    category: "testing",
    prompt: "Explain git rebase versus merge, and when you'd use each.",
  },
  {
    id: "test-14",
    category: "testing",
    prompt: "What goes in a CI pipeline, and why in that order?",
  },
  {
    id: "test-15",
    category: "testing",
    prompt: "How would you find out which commit introduced a bug?",
  },
  {
    id: "test-16",
    category: "testing",
    prompt: "A page got slower and nobody knows why. How do you find out?",
  },
  {
    id: "test-17",
    category: "testing",
    prompt:
      "Explain what technical debt is, and how you'd argue for time to pay some down.",
  },
  {
    id: "test-18",
    category: "testing",
    prompt:
      "How do you write a bug report that a colleague can actually act on?",
  },
  {
    id: "test-19",
    category: "testing",
    prompt:
      "What's the difference between logging and monitoring? What do you log?",
  },
  {
    id: "test-20",
    category: "testing",
    prompt:
      "You've fixed a bug. How do you convince yourself it's actually fixed?",
  },
];
