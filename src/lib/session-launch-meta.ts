import type { InterviewSetupState, VoiceSetupConfig } from "@/lib/interview-setup";
import type { InterviewLoopConfig } from "@/lib/interview-rounds";
import type { AnalysisResult, TechnicalScores } from "@/lib/response-analyzer";
import type { CompetencyCoverage } from "@/lib/competencies";

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
  /**
   * Handover note from earlier rounds of the same loop. Server-written at round
   * handoff and injected into the interviewer's stable prompt layer.
   */
  loopBrief?: string;
}

export interface LoopProgress {
  loopId: string;
  loop: InterviewLoopConfig;
  /** Rounds finished *before* this session. Empty on round 1. */
  completedSessionIds: string[];
}

export interface SessionMetricsPayload {
  launch?: SessionLaunchMeta;
  loop?: LoopProgress;
  /**
   * Which competencies this session has actually probed. Server-owned: written
   * by /api/chat after each question is scored, and stripped from client
   * PATCHes so the live-metrics write cannot wipe it.
   */
  competencyCoverage?: CompetencyCoverage;
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

/**
 * Progress for the *first* round of a loop. Later rounds are built by
 * `/api/sessions/[id]/next-round`, which carries the chain forward.
 *
 * This used to take a session id and an existing progress object, and the sole
 * caller passed `""` and nothing — the id branch was unreachable, and it read
 * `completedSessionIds` as "rounds including this one" where next-round reads
 * it as "rounds finished before this one". Round 1 has completed nothing.
 */
export function buildLoopProgress(
  launch: SessionLaunchMeta,
): LoopProgress | null {
  if (!launch.interviewLoop.enabled) return null;
  return {
    loopId: crypto.randomUUID(),
    loop: launch.interviewLoop,
    completedSessionIds: [],
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

/**
 * Read the server-owned session fields.
 *
 * Migration 0009 promoted these out of the `metrics` blob into their own
 * columns but deliberately left the old keys in place for one release, so a
 * rollback loses nothing. These helpers prefer the column and fall back to the
 * blob — delete the fallback (and these functions) once 0009 is proven and the
 * legacy keys are dropped.
 */
interface SessionColumns {
  metrics: Record<string, unknown> | null;
  launchMeta?: SessionLaunchMeta | null;
  loopProgress?: LoopProgress | null;
  competencyCoverage?: CompetencyCoverage | null;
}

export function readLaunchMeta(
  session: SessionColumns,
): SessionLaunchMeta | undefined {
  return session.launchMeta ?? parseSessionMetrics(session.metrics).launch;
}

export function readLoopProgress(
  session: SessionColumns,
): LoopProgress | undefined {
  return session.loopProgress ?? parseSessionMetrics(session.metrics).loop;
}

export function readCompetencyCoverage(session: SessionColumns): unknown {
  return (
    session.competencyCoverage ??
    parseSessionMetrics(session.metrics).competencyCoverage
  );
}
