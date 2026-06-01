import type { AnalysisResult, InterviewStrategy } from "./responseAnalyzer";

export interface FollowupGenerationContext {
  personaName: string;
  personaRole?: string;
  personaStyle?: string;
  priorQuestion?: string;
  followupTopic?: string;
  allowEscalation?: boolean;
}

function excerpt(text: string, wordLimit = 3): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, wordLimit).join(" ");
}

function buildPersonaLead(context: FollowupGenerationContext): string {
  const parts = [
    `As ${context.personaName}`,
    context.personaRole ? `the ${context.personaRole}` : null,
    context.personaStyle ? `speaking in a ${context.personaStyle} style` : null,
  ].filter(Boolean);

  return `${parts.join(", ")},`;
}

export function buildFollowupPrompt(
  strategy: InterviewStrategy,
  analysis: AnalysisResult,
  context: FollowupGenerationContext,
): string {
  const lead = buildPersonaLead(context);
  const topic =
    context.followupTopic ?? analysis.followupTopics[0] ?? "the answer";
  const prior = context.priorQuestion
    ? ` after asking, “${context.priorQuestion}”`
    : "";
  const escalation = context.allowEscalation
    ? " Be appropriately firm if the candidate stays vague."
    : "";

  switch (strategy) {
    case "CLARIFY_SITUATION":
      return `${lead} I need to understand the situation and task more clearly${prior}. What was happening, who was involved, and what specifically needed to be solved?${escalation}`;
    case "PROBE_ACTION":
      return `${lead} I understand the setup, but I want the exact actions${prior}. Walk me through what you personally did, step by step, and explain why you chose that approach.${escalation}`;
    case "CHALLENGE_OWNERSHIP":
      return `${lead} I want to separate your own contribution from the team's work${prior}. Which decisions did you make yourself, what did you influence, and what was outside your control?${escalation}`;
    case "EXPLORE_RESULT":
      return `${lead} I need to understand the outcome${prior}. What happened after your actions, how did you measure success, and what changed because of it?${escalation}`;
    case "ACKNOWLEDGE_STRENGTH":
      return `${lead} that was a strong answer${prior}. Now go one level deeper: what was the hardest part, and what trade-off did you have to make while handling ${topic}?${escalation}`;
    case "DRILL_SPECIFICITY":
      return `${lead} the response is still too abstract${prior}. Give me a concrete example of ${topic} and include enough detail that I can picture exactly what happened.${escalation}`;
    case "ASSESS_THINKING":
      return `${lead} I want to understand how you think${prior}. What factors did you weigh, what alternatives did you consider, and why did you settle on that decision?${escalation}`;
    default:
      return `${lead} tell me more about ${topic}.${escalation}`;
  }
}

export function summarizeFollowup(
  strategy: InterviewStrategy,
  analysis: AnalysisResult,
): string {
  const topic = analysis.followupTopics[0] ?? "the response";
  const actionSnippet = excerpt(analysis.starAnalysis.action.summary || "", 4);

  if (strategy === "ACKNOWLEDGE_STRENGTH") {
    return `Strong response on ${topic}. Push for deeper reasoning after acknowledging the strength.`;
  }

  if (strategy === "DRILL_SPECIFICITY" && actionSnippet) {
    return `Ask for a concrete example of ${actionSnippet}.`;
  }

  return `Focus on ${topic}.`;
}
