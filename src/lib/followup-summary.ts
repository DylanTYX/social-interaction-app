import type { AnalysisResult, InterviewStrategy } from "./response-analyzer";

function excerpt(text: string, wordLimit = 3): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, wordLimit).join(" ");
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
