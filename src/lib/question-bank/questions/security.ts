import type { DrillQuestion } from "../categories";

/**
 * The gap the CS2023 survey exposed.
 *
 * The bank previously contained no security content at all, despite Security
 * being one of CS2023's seventeen knowledge areas, Microsoft naming TLS in its
 * published interview guidance, and injection and auth questions being routine
 * for new graduates in any backend interview.
 */
export const SECURITY_QUESTIONS: DrillQuestion[] = [
  {
    id: "sec-1",
    category: "security",
    prompt: "Explain the difference between authentication and authorization.",
  },
  {
    id: "sec-2",
    category: "security",
    prompt:
      "What's the difference between hashing and encryption? When do you want each?",
  },
  {
    id: "sec-3",
    category: "security",
    prompt:
      "How should passwords be stored? Why isn't a fast hash good enough?",
  },
  {
    id: "sec-4",
    category: "security",
    prompt: "What is salting, and what attack does it defeat?",
  },
  {
    id: "sec-5",
    category: "security",
    prompt:
      "Explain symmetric versus asymmetric encryption, and why TLS uses both.",
  },
  {
    id: "sec-6",
    category: "security",
    prompt:
      "Walk me through what actually happens when you connect to an HTTPS site.",
  },
  {
    id: "sec-7",
    category: "security",
    prompt: "What is a certificate authority, and what problem does it solve?",
  },
  {
    id: "sec-8",
    category: "security",
    prompt:
      "Explain SQL injection and how you'd prevent it. Why isn't escaping enough?",
  },
  {
    id: "sec-9",
    category: "security",
    prompt:
      "What is cross-site scripting? Explain the difference between stored and reflected.",
  },
  {
    id: "sec-10",
    category: "security",
    prompt: "Explain CSRF. What makes it different from XSS?",
  },
  {
    id: "sec-11",
    category: "security",
    prompt:
      "What is SSRF, and why is it dangerous in a cloud environment specifically?",
  },
  {
    id: "sec-12",
    category: "security",
    prompt: "Explain the principle of least privilege with a concrete example.",
  },
  {
    id: "sec-13",
    category: "security",
    prompt:
      "What's the CIA triad? Give me a tradeoff between two of the three.",
  },
  {
    id: "sec-14",
    category: "security",
    prompt:
      "How would you store an API key in an application? What's wrong with the obvious answer?",
  },
  {
    id: "sec-15",
    category: "security",
    prompt:
      "Explain what a JWT is and one thing people commonly get wrong with them.",
  },
  {
    id: "sec-16",
    category: "security",
    prompt:
      "What is a digital signature, and what does it prove that encryption doesn't?",
  },
  {
    id: "sec-17",
    category: "security",
    prompt:
      "Explain rate limiting as a security control. What attacks does it blunt?",
  },
  {
    id: "sec-18",
    category: "security",
    prompt: "What is two-factor authentication actually protecting against?",
  },
  {
    id: "sec-19",
    category: "security",
    prompt:
      "You've found a hardcoded credential in the repository history. What do you do?",
  },
  {
    id: "sec-20",
    category: "security",
    prompt: "How do you decide what to log when the data might be sensitive?",
  },
];
