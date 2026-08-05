import type { InterviewSessionState } from "@/lib/interview-state-machine";
import type { InterviewMetrics } from "@/lib/interview-metrics";

/**
 * Presentation of interview state, shared by the text and voice screens.
 *
 * These were byte-identical copies in both screens. The voice screen also
 * skipped `getStageGuidance` entirely and passed an empty string, so its
 * advanced-state dialog rendered a blank paragraph.
 */

type Stage = InterviewSessionState["currentStage"];

const STAGE_LABELS: Record<Stage, string> = {
  intro: "Opening",
  questioning: "Exploration",
  analysis: "Review",
  strategy: "Decision",
  followup: "Follow-up",
  wrap_up: "Wrap-up",
  report: "Report",
};

export function getStageLabel(stage: Stage): string {
  return STAGE_LABELS[stage] ?? "In progress";
}

const STAGE_GUIDANCE: Record<Stage, string> = {
  intro: "Start broad, then narrow toward a concrete example.",
  questioning:
    "Keep the candidate talking in STAR form and collect specifics.",
  analysis: "The response has been analyzed. Use the follow-up to push depth.",
  strategy: "Target the weakest STAR element with the next question.",
  followup: "Ask the next targeted question and watch for specificity.",
  wrap_up:
    "Close with reflection, lessons learned, and a final check on impact.",
  report: "Session complete. Review the summary and performance trends.",
};

export function getStageGuidance(
  stage: Stage,
  metrics: InterviewMetrics | null,
  followupPrompt: string | null,
): string {
  // Two stages say something more specific when there is context to use.
  if (stage === "strategy" && metrics && metrics.averageOverallScore > 75) {
    return "The answer is strong. Shift toward trade-offs and reasoning.";
  }
  if (stage === "followup" && followupPrompt) {
    return `Adaptive follow-up ready: ${followupPrompt}`;
  }
  return (
    STAGE_GUIDANCE[stage] ??
    "Continue the interview and adjust difficulty based on the last answer."
  );
}

export function getMetricTone(metrics: InterviewMetrics | null): string {
  if (!metrics) return "Waiting for the first scored response.";
  if (metrics.improvementTrend === "improving") {
    return "The candidate is improving across responses.";
  }
  if (metrics.improvementTrend === "declining") {
    return "The candidate is losing specificity or confidence.";
  }
  return "The response quality is holding steady.";
}

/** Short clock label used on every message bubble. */
export function formatMessageTime(date: Date = new Date()): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
