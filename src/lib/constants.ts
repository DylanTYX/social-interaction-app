export const SAMPLE_MESSAGES = [
  {
    id: "1",
    role: "ai" as const,
    content:
      "Good morning! Thank you for taking the time to meet with me today. I understand you'd like to discuss the Q3 performance results?",
    timestamp: "10:00 AM",
  },
  {
    id: "2",
    role: "user" as const,
    content:
      "Yes, that's right. I wanted to walk you through our key metrics and outcomes for this quarter.",
    timestamp: "10:01 AM",
  },
  {
    id: "3",
    role: "ai" as const,
    content:
      "Perfect. I have about 30 minutes allocated for this discussion. Could you start with the high-level overview?",
    timestamp: "10:01 AM",
  },
] as const;

export const DEMO_PERSONA_NAME = "Sarah Chen";
