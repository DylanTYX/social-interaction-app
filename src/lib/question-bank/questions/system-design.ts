import type { DrillQuestion } from "../categories";

/**
 * The only technical topic marked against `system_design`.
 *
 * Its rubric — requirements and scale first, then architecture, then the
 * tradeoff and what it costs — describes these answers and nothing else in the
 * bank. Also absorbs the distributed-systems, backend and API domains from the
 * research, since in an interview they arrive as parts of this conversation.
 */
export const SYSTEM_DESIGN_QUESTIONS: DrillQuestion[] = [
  {
    id: "sd-1",
    category: "system_design",
    prompt:
      "Design a URL shortener. Start with the requirements and key tradeoffs.",
  },
  {
    id: "sd-2",
    category: "system_design",
    prompt:
      "Design a news feed for a social app. How do you handle fan-out and scale?",
  },
  {
    id: "sd-3",
    category: "system_design",
    prompt:
      "Design a rate limiter for a public API. Walk through the approach.",
  },
  {
    id: "sd-4",
    category: "system_design",
    prompt:
      "Design a chat application that supports millions of concurrent users.",
  },
  {
    id: "sd-5",
    category: "system_design",
    prompt:
      "Design a file storage service like Dropbox. Start with what you're optimising for.",
  },
  {
    id: "sd-6",
    category: "system_design",
    prompt:
      "Design a notification system that handles email, push and SMS at scale.",
  },
  {
    id: "sd-7",
    category: "system_design",
    prompt:
      "Design a ticket booking system. How do you stop two people buying the same seat?",
  },
  {
    id: "sd-8",
    category: "system_design",
    prompt:
      "How would you estimate the storage and bandwidth for a photo-sharing app with ten million users?",
  },
  {
    id: "sd-9",
    category: "system_design",
    prompt: "Explain when you'd add a message queue, and what it makes harder.",
  },
  {
    id: "sd-10",
    category: "system_design",
    prompt:
      "Where would you put caching in a read-heavy system, and how do you invalidate it?",
  },
  {
    id: "sd-11",
    category: "system_design",
    prompt:
      "Explain the tradeoff between consistency and availability with a concrete product decision.",
  },
  {
    id: "sd-12",
    category: "system_design",
    prompt: "What is idempotency, and why does it matter for a payments API?",
  },
  {
    id: "sd-13",
    category: "system_design",
    prompt:
      "Design a system that has to work when a whole data centre goes offline.",
  },
  {
    id: "sd-14",
    category: "system_design",
    prompt:
      "Explain monolith versus microservices. When is a monolith the right answer?",
  },
  {
    id: "sd-15",
    category: "system_design",
    prompt:
      "How would you design an API for a service other teams depend on? What do you version?",
  },
  {
    id: "sd-16",
    category: "system_design",
    prompt: "Explain what a circuit breaker does and what failure it prevents.",
  },
  {
    id: "sd-17",
    category: "system_design",
    prompt: "How would you handle retries without making an outage worse?",
  },
  {
    id: "sd-18",
    category: "system_design",
    prompt:
      "Design the analytics pipeline for tracking events across a product. Batch or streaming, and why?",
  },
  {
    id: "sd-19",
    category: "system_design",
    prompt:
      "What would you monitor to know this system is healthy? Pick three signals and justify them.",
  },
  {
    id: "sd-20",
    category: "system_design",
    prompt:
      "Design a search feature over ten million documents. Start with the requirements.",
  },
];
