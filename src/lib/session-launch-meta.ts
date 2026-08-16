import {
  createDefaultJobDescriptionConfig,
  createDefaultResumeConfig,
  normalizeVoiceConfig,
  type InterviewSetupState,
  type VoiceSetupConfig,
} from "@/lib/interview-setup";
import {
  normalizeInterviewLoop,
  type InterviewLoopConfig,
} from "@/lib/interview-rounds";
import type { PracticeMode } from "@/lib/interview-setup";
import {
  MAX_SCENARIO_DESCRIPTION_CHARS,
  MAX_SCENARIO_TITLE_CHARS,
} from "@/lib/api/input-limits";
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

/**
 * Both attachments as they stand *now*, with any deleted one switched off.
 *
 * `launch_meta` is a snapshot taken at launch and never revised; the session's
 * `job_description_id` / `resume_id` columns are current, and both FKs are
 * `on delete set null`. So after a delete the snapshot still says
 * `enabled: true` with a `savedId` its own session's column contradicts, and
 * anything that copies the snapshot forward — the next round of a loop, the
 * report page's "Practise again" — carries the dead reference into a new
 * session that would then fail at the foreign key.
 *
 * One helper rather than three, because it was already written twice and
 * getting it right needs both sources: the column alone cannot distinguish
 * "never had one" from "had one, deleted", and the snapshot alone never learns
 * about a delete at all.
 */
export function withoutDeletedAttachments(
  launch: SessionLaunchMeta,
  session: { jobDescriptionId: string | null; resumeId: string | null },
): Pick<InterviewSetupState, "jobDescription" | "resume"> {
  // Both defaulted, because a snapshot is whatever was stored: pre-0009 rows
  // predate the CV entirely, and `sanitizeLaunchMeta` drops a job-description
  // key it does not recognise. Reading `.enabled` off either one unguarded is
  // a crash on the next-round path.
  const jobDescription =
    launch.jobDescription ?? createDefaultJobDescriptionConfig();
  const resume = launch.resume ?? createDefaultResumeConfig();
  return {
    jobDescription: isDeleted(jobDescription, session.jobDescriptionId)
      ? { ...jobDescription, enabled: false, savedId: null }
      : jobDescription,
    resume: isDeleted(resume, session.resumeId)
      ? { ...resume, enabled: false, savedId: null, savedTitle: null }
      : resume,
  };
}

function isDeleted(
  snapshot: { enabled: boolean; savedId?: string | null },
  columnId: string | null,
): boolean {
  return Boolean(snapshot.enabled && snapshot.savedId && !columnId);
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

/**
 * Maximum rounds in one loop. A real interview day is four or five rounds;
 * this is a bug/abuse ceiling, since every round's title and focus reaches the
 * interviewer's prompt.
 */
const MAX_LOOP_ROUNDS = 10;

function clampText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * Sanitize client-supplied launch metadata before it is stored.
 *
 * `POST /api/sessions` used to take `body.launchMeta`, cast it straight through
 * with `as SessionLaunchMeta`, and write it to the `launch_meta` column.
 * `normalizeInterviewLoop` was never called server-side at all. Two things
 * followed from that:
 *
 *   1. `loopBrief` is documented as server-written at round handoff, and
 *      `/api/chat` injects it verbatim into the interviewer's *stable* prompt
 *      layer. A client could therefore write its own system-prompt content.
 *      It is dropped here unconditionally — only `next-round` may set it.
 *   2. Round titles, focus text and the scenario brief also reach the prompt,
 *      with no length bound and no cap on how many rounds could be sent.
 *
 * RLS means none of this crossed a tenant boundary — a user could only do it to
 * their own session. It is still a server-owned field the client could write,
 * and unbounded text billed on every turn.
 *
 * Text is clamped rather than rejected here, unlike `parseBoundedString`: this
 * payload is rebuilt from localStorage on every launch, so an outdated or
 * oversized value should degrade to a usable session rather than block the user
 * from starting one.
 */
function withoutRawText<T extends { rawText?: unknown } | undefined | null>(
  config: T,
): T {
  if (!config || typeof config !== "object") return config;
  return { ...config, rawText: "" };
}

export function sanitizeLaunchMeta(
  value: unknown,
  practiceMode: PracticeMode,
): SessionLaunchMeta | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<SessionLaunchMeta>;

  const loop = normalizeInterviewLoop(input.interviewLoop, practiceMode);
  const rounds = loop.rounds.slice(0, MAX_LOOP_ROUNDS).map((round) => ({
    ...round,
    title: clampText(round.title, MAX_SCENARIO_TITLE_CHARS) ?? round.title,
    focus:
      clampText(round.focus, MAX_SCENARIO_DESCRIPTION_CHARS) ?? round.focus,
  }));

  return {
    streamResponses: Boolean(input.streamResponses),
    liveCoachingEnabled: Boolean(input.liveCoachingEnabled),
    interviewLoop: {
      ...loop,
      rounds,
      enabled: loop.enabled && rounds.length > 1,
      currentRoundIndex: Math.max(
        0,
        Math.min(rounds.length - 1, loop.currentRoundIndex),
      ),
    },
    // Normalized, not cast. This was `as SessionLaunchMeta["voiceConfig"]`,
    // which asserts a shape rather than checking one — so whatever the client
    // sent was written to `launch_meta` verbatim.
    voiceConfig: normalizeVoiceConfig(input.voiceConfig),
    /**
     * Document text is stripped before this is stored.
     *
     * Both configs carry a `rawText` copy of the whole document, and nothing
     * ever reads it back off the session — the id is in a foreign key column
     * and the server fetches the text from its own table. Keeping the copy had
     * two costs. It is unbounded, so it inflated `launch_meta` on every session
     * (and `/resume` and `/export`, which echo it back). And it outlived the
     * document: deleting a resume nulls `resume_id` but left the full CV — real
     * names, employers, dates — sitting in the launch metadata of every session
     * that had used it, and in any export taken afterwards. "Delete my resume"
     * has to mean it.
     */
    jobDescription: withoutRawText(
      input.jobDescription as SessionLaunchMeta["jobDescription"],
    ),
    resume: withoutRawText(input.resume),
    customScenarioBrief: clampText(
      input.customScenarioBrief,
      MAX_SCENARIO_DESCRIPTION_CHARS,
    ),
    personaLibraryId: clampText(input.personaLibraryId, 100),
    // `loopBrief` is deliberately absent. It is server-owned; see above.
  };
}
