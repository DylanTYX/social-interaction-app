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
}

const REPORT_STORAGE_KEY = "social-interaction-app.interviewReport";

export function saveInterviewReportSnapshot(
  snapshot: InterviewReportSnapshot,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function loadInterviewReportSnapshot(): InterviewReportSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(REPORT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as InterviewReportSnapshot;
  } catch {
    return null;
  }
}
