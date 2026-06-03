import type { InterviewSessionState } from "./interviewStateMachine";
import type { InterviewMetrics } from "./metricsTracker";
import type { AnalysisResult, InterviewStrategy } from "./responseAnalyzer";

export interface InterviewReportSnapshot {
  sessionState: InterviewSessionState;
  metrics: InterviewMetrics | null;
  analyses: AnalysisResult[];
  strategyHistory: InterviewStrategy[];
  scenarioTitle: string;
  scenarioDescription: string;
  personaName: string;
  generatedAt: string;
  /**
   * Optional reference to the job description that grounded this interview.
   * Stored as a lightweight summary so the report can render a chip without
   * re-fetching the full record.
   */
  jobDescription?: {
    id: string;
    title: string;
    roleTitle: string | null;
  } | null;
}

/**
 * Compute an overall numeric score from the metrics or analyses. Used when
 * patching the Supabase session row at the end of an interview. The full
 * report page now reads its data straight from Supabase, so the previous
 * sessionStorage-based snapshot helpers were removed.
 */
export function computeAverageScore(
  snapshot: InterviewReportSnapshot,
): number | null {
  const overall = snapshot.metrics?.averageOverallScore;
  if (typeof overall === "number" && Number.isFinite(overall)) {
    return Math.round(overall);
  }
  if (snapshot.analyses.length === 0) return null;
  const total = snapshot.analyses.reduce(
    (sum, item) => sum + (item.overallScore ?? 0),
    0,
  );
  return Math.round(total / snapshot.analyses.length);
}
