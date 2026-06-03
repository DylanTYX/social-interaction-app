const ONBOARDING_KEY = "convotrainer.onboardingComplete";
const ONBOARDING_GOAL_KEY = "convotrainer.onboardingGoal";

export type OnboardingGoal =
  | "job-interview"
  | "feedback"
  | "negotiation"
  | "presentation"
  | "custom";

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingComplete(goal?: OnboardingGoal): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
    if (goal) {
      window.localStorage.setItem(ONBOARDING_GOAL_KEY, goal);
    }
  } catch {
    // ignore
  }
}

export function getOnboardingGoal(): OnboardingGoal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_GOAL_KEY);
    if (
      raw === "job-interview" ||
      raw === "feedback" ||
      raw === "negotiation" ||
      raw === "presentation" ||
      raw === "custom"
    ) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export interface OnboardingDefaults {
  scenarioValue: string;
  customScenarioBrief?: string;
  practiceMode: "text" | "voice";
}

export function defaultsForGoal(goal: OnboardingGoal): OnboardingDefaults {
  switch (goal) {
    case "job-interview":
      return {
        scenarioValue: "custom",
        customScenarioBrief:
          "I'm preparing for an end-to-end job interview. Expect a mix of background questions, behavioral STAR stories, and role-specific questions.",
        practiceMode: "text",
      };
    case "feedback":
      return {
        scenarioValue: "custom",
        customScenarioBrief:
          "I want to practice delivering constructive feedback to a teammate, including the tough parts and follow-up questions.",
        practiceMode: "text",
      };
    case "negotiation":
      return {
        scenarioValue: "custom",
        customScenarioBrief:
          "I want to rehearse a salary or scope negotiation, including pushback from the other side.",
        practiceMode: "voice",
      };
    case "presentation":
      return {
        scenarioValue: "custom",
        customScenarioBrief:
          "I'm presenting to senior stakeholders and want to handle tough questions, pushback, and clarifying drills.",
        practiceMode: "text",
      };
    case "custom":
      return {
        scenarioValue: "custom",
        customScenarioBrief:
          "A challenging workplace conversation I want to rehearse.",
        practiceMode: "text",
      };
    default:
      return {
        scenarioValue: "custom",
        customScenarioBrief: "Interview practice session.",
        practiceMode: "text",
      };
  }
}
