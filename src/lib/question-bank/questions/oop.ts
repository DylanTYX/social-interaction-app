import type { DrillQuestion } from "../categories";

/**
 * OOP, SOLID, patterns, and low-level design.
 *
 * Marked against `cs_fundamentals`: define, contrast, ground it. The LLD
 * prompts at the end are still spoken — "talk me through the classes" — since
 * an interviewer asking you to design a parking lot expects narration, not a
 * file of source.
 */
export const OOP_QUESTIONS: DrillQuestion[] = [
  {
    id: "oop-1",
    category: "oop",
    prompt:
      "Explain encapsulation and abstraction. People use them interchangeably — what's actually different?",
  },
  {
    id: "oop-2",
    category: "oop",
    prompt:
      "What's the difference between compile-time and runtime polymorphism?",
  },
  {
    id: "oop-3",
    category: "oop",
    prompt:
      "When would you choose composition over inheritance? Give me a case where inheritance was the wrong call.",
  },
  {
    id: "oop-4",
    category: "oop",
    prompt:
      "Explain the difference between an interface and an abstract class, and when you'd reach for each.",
  },
  {
    id: "oop-5",
    category: "oop",
    prompt:
      "What is the diamond problem, and how does the language you use deal with it?",
  },
  {
    id: "oop-6",
    category: "oop",
    prompt:
      "Explain the single responsibility principle. How do you know when a class has more than one?",
  },
  {
    id: "oop-7",
    category: "oop",
    prompt:
      "What does the open/closed principle mean in practice? Give me a concrete example.",
  },
  {
    id: "oop-8",
    category: "oop",
    prompt:
      "Explain the Liskov substitution principle, and a violation you've seen or written.",
  },
  {
    id: "oop-9",
    category: "oop",
    prompt:
      "What is dependency inversion, and how is it different from dependency injection?",
  },
  {
    id: "oop-10",
    category: "oop",
    prompt:
      "Explain coupling and cohesion. Which one do you optimise for first?",
  },
  {
    id: "oop-11",
    category: "oop",
    prompt:
      "Talk me through the Singleton pattern and why a lot of people consider it an anti-pattern.",
  },
  {
    id: "oop-12",
    category: "oop",
    prompt:
      "When would you use a Factory? What does it buy you over calling the constructor?",
  },
  {
    id: "oop-13",
    category: "oop",
    prompt:
      "Explain the Observer pattern and somewhere you've seen it in a framework you use.",
  },
  {
    id: "oop-14",
    category: "oop",
    prompt:
      "What's the difference between association, aggregation and composition?",
  },
  {
    id: "oop-15",
    category: "oop",
    prompt:
      "How do you design a class to be extensible without making it complicated today?",
  },
  {
    id: "oop-16",
    category: "oop",
    prompt:
      "Talk me through designing a parking lot: the classes, their responsibilities, and how they relate.",
  },
  {
    id: "oop-17",
    category: "oop",
    prompt:
      "Design an elevator system. Walk me through the objects and where the scheduling logic lives.",
  },
  {
    id: "oop-18",
    category: "oop",
    prompt:
      "Talk me through the design of an in-memory LRU cache — the interface first, then how it works.",
  },
  {
    id: "oop-19",
    category: "oop",
    prompt:
      "Design a notification system that supports email, SMS and push. Where do you put the differences?",
  },
  {
    id: "oop-20",
    category: "oop",
    prompt:
      "What makes an API pleasant to use? Talk me through one you've used that got it wrong.",
  },
];
