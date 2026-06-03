import type { InterviewSetupState, VoiceSetupConfig } from "@/lib/interview-setup";
import type { InterviewLoopConfig } from "@/lib/interview-rounds";
import type { AnalysisResult, TechnicalScores } from "@/lib/responseAnalyzer";

/**
 * Lightweight launch metadata stored on `interview_sessions.metrics` so a
 * session can be resumed in another tab or device.
 */
export interface SessionLaunchMeta {
  streamResponses: boolean;
  liveCoachingEnabled: boolean;
  interviewLoop: InterviewLoopConfig;
  voiceConfig: VoiceSetupConfig;
  jobDescription: InterviewSetupState["jobDescription"];
  resume?: InterviewSetupState["resume"];
  customScenarioBrief?: string;
  personaLibraryId?: string;
}

export interface LoopProgress {
  loopId: string;
  loop: InterviewLoopConfig;
  completedSessionIds: string[];
}

export interface SessionMetricsPayload {
  launch?: SessionLaunchMeta;
  loop?: LoopProgress;
  dimensionSnapshots?: DimensionSnapshot[];
  [key: string]: unknown;
}

export interface DimensionSnapshot {
  clarity: number;
  specificity: number;
  confidence: number;
  star: number;
  recordedAt: string;
}

export function buildLaunchMetaFromSetup(
  setup: InterviewSetupState,
): SessionLaunchMeta {
  return {
    streamResponses: setup.streamResponses,
    liveCoachingEnabled: setup.liveCoachingEnabled,
    interviewLoop: setup.interviewLoop,
    voiceConfig: setup.voiceConfig,
    jobDescription: setup.jobDescription,
    resume: setup.resume,
    customScenarioBrief: setup.customScenarioBrief,
    personaLibraryId: setup.personaLibraryId,
  };
}

export function parseSessionMetrics(
  metrics: Record<string, unknown> | null | undefined,
): SessionMetricsPayload {
  if (!metrics || typeof metrics !== "object") {
    return {};
  }
  return metrics as SessionMetricsPayload;
}

function averageTechnicalScore(scores: TechnicalScores): number {
  const values = [
    scores.problemFraming,
    scores.approach,
    scores.correctness,
    scores.complexity,
    scores.communication,
    scores.edgeCases,
    scores.codeQuality,
  ];
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function dimensionSnapshotFromAnalysis(
  analysis: AnalysisResult,
): DimensionSnapshot {
  const starFromBehavioral =
    (analysis.starAnalysis.situation.quality +
      analysis.starAnalysis.task.quality +
      analysis.starAnalysis.action.quality +
      analysis.starAnalysis.result.quality) /
    4;
  const star = analysis.technicalScores
    ? averageTechnicalScore(analysis.technicalScores)
    : starFromBehavioral;

  return {
    clarity: Math.round(analysis.confidenceIndicators.clarity * 10),
    specificity: Math.round(
      (10 - analysis.specificityMetrics.vaguenessScore) * 10,
    ),
    confidence: Math.round(
      analysis.confidenceIndicators.assertivenessScore * 10,
    ),
    star: Math.round(star * 10),
    recordedAt: new Date().toISOString(),
  };
}

export function buildLoopProgress(
  launch: SessionLaunchMeta,
  sessionId: string,
  existing?: LoopProgress | null,
): LoopProgress | null {
  if (!launch.interviewLoop.enabled) return null;
  const loopId = existing?.loopId ?? crypto.randomUUID();
  const completedSessionIds = existing?.completedSessionIds ?? [];
  if (!completedSessionIds.includes(sessionId)) {
    completedSessionIds.push(sessionId);
  }
  return {
    loopId,
    loop: launch.interviewLoop,
    completedSessionIds,
  };
}

export function appendDimensionSnapshot(
  metrics: SessionMetricsPayload,
  analysis: AnalysisResult,
): SessionMetricsPayload {
  const snapshot = dimensionSnapshotFromAnalysis(analysis);
  const existing = metrics.dimensionSnapshots ?? [];
  return {
    ...metrics,
    dimensionSnapshots: [...existing, snapshot].slice(-30),
  };
}
