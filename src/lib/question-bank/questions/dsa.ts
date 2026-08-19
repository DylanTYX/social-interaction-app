import type { DrillQuestion } from "../categories";

/**
 * The most universal technical topic, and deliberately spoken.
 *
 * Every prompt asks the candidate to *talk* — "walk me through", "talk through
 * your approach and complexity". That is not a limitation of the drills page;
 * it is what the round actually tests. `COACH_RUBRICS.technical_swe` names
 * "code delivered with no narration, so the reasoning is invisible" as its
 * first failure mode.
 */
export const DSA_QUESTIONS: DrillQuestion[] = [
  {
    id: "dsa-1",
    category: "dsa",
    prompt:
      "How would you find the first non-repeating character in a string? Talk through your approach and complexity.",
  },
  {
    id: "dsa-2",
    category: "dsa",
    prompt:
      "Explain the difference between a hash map and a balanced binary search tree, and when you'd choose each.",
  },
  {
    id: "dsa-3",
    category: "dsa",
    prompt:
      "How would you detect a cycle in a linked list? Walk me through it.",
  },
  {
    id: "dsa-4",
    category: "dsa",
    prompt:
      "When would you reach for a stack over a queue? Give me a concrete problem for each.",
  },
  {
    id: "dsa-5",
    category: "dsa",
    prompt:
      "Talk me through binary search, and the two conditions the input has to satisfy.",
  },
  {
    id: "dsa-6",
    category: "dsa",
    prompt:
      "Explain the two-pointer technique and a problem where it beats the brute force.",
  },
  {
    id: "dsa-7",
    category: "dsa",
    prompt:
      "What is the sliding window technique? Walk me through using it to find the longest substring without repeating characters.",
  },
  {
    id: "dsa-8",
    category: "dsa",
    prompt:
      "Compare BFS and DFS. When does the choice between them actually matter?",
  },
  {
    id: "dsa-9",
    category: "dsa",
    prompt:
      "How would you find the shortest path in an unweighted graph, and what changes if it's weighted?",
  },
  {
    id: "dsa-10",
    category: "dsa",
    prompt:
      "What makes a problem suitable for dynamic programming? Talk me through one you'd solve that way.",
  },
  {
    id: "dsa-11",
    category: "dsa",
    prompt:
      "Explain memoization versus tabulation, and when you'd prefer each.",
  },
  {
    id: "dsa-12",
    category: "dsa",
    prompt:
      "When is a greedy algorithm correct, and how would you convince me yours is?",
  },
  {
    id: "dsa-13",
    category: "dsa",
    prompt:
      "Talk me through how a hash map handles collisions, and what that does to its worst case.",
  },
  {
    id: "dsa-14",
    category: "dsa",
    prompt:
      "Why is quicksort usually faster than mergesort in practice when they have the same average complexity?",
  },
  {
    id: "dsa-15",
    category: "dsa",
    prompt:
      "What is a heap, and what problem would make you reach for a priority queue?",
  },
  {
    id: "dsa-16",
    category: "dsa",
    prompt:
      "How would you find the k largest elements in a very large stream of numbers?",
  },
  {
    id: "dsa-17",
    category: "dsa",
    prompt: "Explain what a trie is and when it beats a hash map.",
  },
  {
    id: "dsa-18",
    category: "dsa",
    prompt:
      "What is amortized complexity? Explain it using a dynamic array that doubles.",
  },
  {
    id: "dsa-19",
    category: "dsa",
    prompt:
      "Talk me through how you'd detect whether a directed graph has a cycle, and where that matters in real software.",
  },
  {
    id: "dsa-20",
    category: "dsa",
    prompt:
      "You have an O(n log n) solution and someone claims O(n) is possible. How do you reason about whether they're right?",
  },
];
