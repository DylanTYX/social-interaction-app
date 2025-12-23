// Sample chat messages for demo
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

// AI Personas
export const PERSONAS = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "Senior Product Manager",
    culture: "Chinese-American",
    communicationStyle: "Direct, data-driven",
    flag: "🇨🇳",
    avatar: "SC",
  },
  {
    id: 2,
    name: "Marcus Johnson",
    role: "VP of Engineering",
    culture: "American",
    communicationStyle: "Assertive, collaborative",
    flag: "🇺🇸",
    avatar: "MJ",
  },
  {
    id: 3,
    name: "Yuki Tanaka",
    role: "Design Lead",
    culture: "Japanese",
    communicationStyle: "Indirect, considerate",
    flag: "🇯🇵",
    avatar: "YT",
  },
  {
    id: 4,
    name: "Priya Sharma",
    role: "Senior Developer",
    culture: "Indian",
    communicationStyle: "Diplomatic, detail-oriented",
    flag: "🇮🇳",
    avatar: "PS",
  },
  {
    id: 5,
    name: "Lars Petersen",
    role: "Operations Director",
    culture: "Danish",
    communicationStyle: "Egalitarian, transparent",
    flag: "🇩🇰",
    avatar: "LP",
  },
  {
    id: 6,
    name: "Isabella Rodriguez",
    role: "Marketing Manager",
    culture: "Spanish",
    communicationStyle: "Expressive, relationship-focused",
    flag: "🇪🇸",
    avatar: "IR",
  },
] as const;

// Practice Scenarios
export const SCENARIOS = [
  {
    id: 1,
    title: "Quarterly Business Review",
    description:
      "Present and discuss quarterly performance metrics with stakeholders",
    category: "Business",
    difficulty: "Intermediate",
    duration: "15-20 min",
    participants: "2-4",
  },
  {
    id: 2,
    title: "Conflict Resolution",
    description:
      "Address and resolve team conflicts with empathy and assertiveness",
    category: "Leadership",
    difficulty: "Advanced",
    duration: "20-30 min",
    participants: "2-3",
  },
  {
    id: 3,
    title: "Client Negotiation",
    description:
      "Negotiate project scope and pricing with international clients",
    category: "Sales",
    difficulty: "Advanced",
    duration: "25-35 min",
    participants: "2",
  },
  {
    id: 4,
    title: "Team Feedback Session",
    description:
      "Deliver constructive feedback to team members across cultures",
    category: "Management",
    difficulty: "Intermediate",
    duration: "10-15 min",
    participants: "2",
  },
  {
    id: 5,
    title: "Product Presentation",
    description:
      "Present new product features to cross-functional stakeholders",
    category: "Communication",
    difficulty: "Beginner",
    duration: "15-20 min",
    participants: "3-5",
  },
  {
    id: 6,
    title: "Salary Negotiation",
    description: "Negotiate compensation and benefits professionally",
    category: "Career",
    difficulty: "Advanced",
    duration: "20-25 min",
    participants: "2",
  },
] as const;

// Cultural Contexts
export const CULTURAL_CONTEXTS = [
  {
    id: 1,
    name: "Chinese",
    code: "🇨🇳",
    characteristics: [
      "Indirect communication",
      "Hierarchical respect",
      "Long-term relationships",
      "Face-saving important",
    ],
  },
  {
    id: 2,
    name: "American",
    code: "🇺🇸",
    characteristics: [
      "Direct communication",
      "Individual achievement",
      "Efficiency-focused",
      "Informal approach",
    ],
  },
  {
    id: 3,
    name: "Japanese",
    code: "🇯🇵",
    characteristics: [
      "Very indirect",
      "Group harmony",
      "Formal protocols",
      "Non-verbal cues",
    ],
  },
  {
    id: 4,
    name: "Indian",
    code: "🇮🇳",
    characteristics: [
      "Relationship-oriented",
      "Hierarchical",
      "Diplomatic approach",
      "Context-sensitive",
    ],
  },
  {
    id: 5,
    name: "Danish",
    code: "🇩🇰",
    characteristics: [
      "Very direct",
      "Egalitarian",
      "Work-life balance",
      "Consensus-driven",
    ],
  },
  {
    id: 6,
    name: "Spanish",
    code: "🇪🇸",
    characteristics: [
      "Expressive communication",
      "Relationship-first",
      "Flexible time",
      "Warm interactions",
    ],
  },
] as const;
