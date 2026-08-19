import type { DrillQuestion } from "../categories";

/**
 * The browser as a runtime, and JavaScript's actual semantics.
 *
 * Framework-agnostic on purpose: "explain the event loop" survives a change of
 * framework, "explain useEffect" does not, and a bank that dates in eighteen
 * months is worse than a smaller one that does not.
 */
export const WEB_FRONTEND_QUESTIONS: DrillQuestion[] = [
  {
    id: "web-1",
    category: "web_frontend",
    prompt:
      "Explain the JavaScript event loop. How does single-threaded code handle concurrency at all?",
  },
  {
    id: "web-2",
    category: "web_frontend",
    prompt:
      "What's the difference between the call stack, the microtask queue and the task queue?",
  },
  {
    id: "web-3",
    category: "web_frontend",
    prompt:
      "Explain what the DOM is, and why touching it repeatedly is expensive.",
  },
  {
    id: "web-4",
    category: "web_frontend",
    prompt: "What's the difference between reflow and repaint?",
  },
  {
    id: "web-5",
    category: "web_frontend",
    prompt:
      "Walk me through the critical rendering path from HTML arriving to pixels on screen.",
  },
  {
    id: "web-6",
    category: "web_frontend",
    prompt:
      "Explain client-side rendering versus server-side rendering. What does hydration mean?",
  },
  {
    id: "web-7",
    category: "web_frontend",
    prompt:
      "What is CORS actually protecting against? Why can't you just turn it off?",
  },
  {
    id: "web-8",
    category: "web_frontend",
    prompt:
      "Explain cookies versus localStorage versus sessionStorage, and when each is the wrong choice.",
  },
  {
    id: "web-9",
    category: "web_frontend",
    prompt: "What is event delegation, and what problem does it solve?",
  },
  {
    id: "web-10",
    category: "web_frontend",
    prompt:
      "Explain the difference between `==` and `===`, and why the first one is a trap.",
  },
  {
    id: "web-11",
    category: "web_frontend",
    prompt: "What is a promise, and how is it different from a callback?",
  },
  {
    id: "web-12",
    category: "web_frontend",
    prompt:
      "Explain prototypal inheritance. How is it different from classical inheritance?",
  },
  {
    id: "web-13",
    category: "web_frontend",
    prompt: "What does `this` refer to in JavaScript, and what changes it?",
  },
  {
    id: "web-14",
    category: "web_frontend",
    prompt: "Explain debouncing versus throttling, and a use case for each.",
  },
  {
    id: "web-15",
    category: "web_frontend",
    prompt:
      "How would you make a page that loads slowly load faster? Where do you look first?",
  },
  {
    id: "web-16",
    category: "web_frontend",
    prompt: "Explain what a bundler does and why tree-shaking matters.",
  },
  {
    id: "web-17",
    category: "web_frontend",
    prompt:
      "How do you decide what belongs in component state versus shared state?",
  },
  {
    id: "web-18",
    category: "web_frontend",
    prompt:
      "What makes a page accessible? Name three things you'd check before shipping.",
  },
  {
    id: "web-19",
    category: "web_frontend",
    prompt:
      "Explain how you'd prevent XSS in a frontend that renders user-supplied content.",
  },
  {
    id: "web-20",
    category: "web_frontend",
    prompt:
      "What is responsive design beyond media queries? How do you decide breakpoints?",
  },
];
