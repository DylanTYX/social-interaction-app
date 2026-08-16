"use client";

import { readJson } from "@/lib/api/fetch-json";
import { useEffect, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { PersonaConfig } from "@/lib/persona-engine";
import {
  normalizeInterviewLoop,
  type InterviewLoopConfig,
} from "@/lib/interview-rounds";
import {
  createDefaultInterviewSetup,
  loadInterviewLaunch,
  saveInterviewLaunch,
  type InterviewLaunchPayload,
  type InterviewSetupState,
  type VoiceSetupConfig,
} from "@/lib/interview-setup";
import { getScenarioByValue } from "@/lib/scenarios";
import type { SessionLaunchMeta } from "@/lib/session-launch-meta";
import type { AnalysisResult } from "@/lib/response-analyzer";

export type BootstrapStatus =
  "loading" | "ready" | "redirect-setup" | "redirect-voice" | "error";

export interface InterviewBootstrap {
  status: BootstrapStatus;
  error: string | null;
  personaConfig: PersonaConfig;
  scenarioValue: string;
  customScenarioBrief: string;
  streamResponses: boolean;
  liveCoachingEnabled: boolean;
  interviewLoop: InterviewLoopConfig;
  sessionId: string | null;
  jobDescriptionTitle: string | null;
  jobDescriptionRef: {
    id: string;
    title: string;
    roleTitle: string | null;
  } | null;
  voiceConfig: VoiceSetupConfig;
  /**
   * The session was configured with a job description that no longer exists.
   *
   * Deleting a JD nulls `interview_sessions.job_description_id` (the FK is
   * `on delete set null`), but `launch_meta` keeps the snapshot taken at launch
   * — still saying `enabled: true` with the now-dead `savedId`. Resuming used
   * to trust the snapshot outright, so the screen showed a confident "grounded
   * on this JD" chip for a document contributing nothing to the prompt or to
   * scoring. A wrong answer stated positively is worse than a missing one.
   *
   * Callers should say so rather than silently dropping the chip: the change in
   * how the interviewer behaves is otherwise unexplainable from the UI.
   */
  jobDescriptionMissing: boolean;
  /**
   * Transcript and scoring history restored from the server, when this load
   * resumed an existing session.
   *
   * It lives here because it arrives in the *same* `/resume` response as the
   * launch config. `useResumedSession` used to issue a second, identical
   * request for it — and since the session id went into every interview URL,
   * that happened on every load rather than only on an explicit resume, so
   * each screen fetched the whole transcript and every turn analysis twice.
   */
  resumed: ResumedTranscript | null;
}

export interface ResumedTranscript {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }>;
  analyses: AnalysisResult[];
  /** The interviewer's most recent decision, or null for a fresh session. */
  lastDecision: LastTurnDecision | null;
}

export interface LastTurnDecision {
  strategy: string | null;
  confidence: number | null;
}

const DEFAULT = createDefaultInterviewSetup();

function readResumedTranscript(payload: {
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
  turnAnalyses?: Array<{
    analysis: unknown;
    strategy?: string | null;
    confidence?: number | null;
  }>;
}): ResumedTranscript {
  return {
    messages: (payload.messages ?? []).map((row) => ({
      id: row.id,
      role: row.role === "user" ? ("user" as const) : ("assistant" as const),
      content: row.content,
      createdAt: row.createdAt,
    })),
    // Pre-0006 sessions have no stored analyses; an empty history is the
    // correct outcome there, not an error.
    analyses: (payload.turnAnalyses ?? [])
      .map((row) => row.analysis as AnalysisResult)
      .filter((analysis): analysis is AnalysisResult => Boolean(analysis)),
    /**
     * The interviewer's last decision, which the server has always persisted
     * and the client has always discarded — the type above declared only
     * `analysis`. After a reload the state panel showed a blank decision
     * history on a session with six follow-ups behind it.
     */
    lastDecision: (() => {
      const last = (payload.turnAnalyses ?? []).at(-1);
      if (!last) return null;
      return {
        strategy: typeof last.strategy === "string" ? last.strategy : null,
        confidence:
          typeof last.confidence === "number" ? last.confidence : null,
      };
    })(),
  };
}

function launchToBootstrap(
  launch: InterviewLaunchPayload,
  searchParams: ReadonlyURLSearchParams,
  jobDescriptionMissing = false,
): InterviewBootstrap {
  const scenarioOverride = searchParams.get("scenario");
  const streamOverride = searchParams.get("stream");

  const jobDescriptionRef =
    launch.jobDescription.enabled && launch.jobDescription.savedId
      ? {
          id: launch.jobDescription.savedId,
          title:
            launch.jobDescription.savedTitle ??
            (launch.jobDescription.roleTitle.trim() || "Job description"),
          roleTitle: launch.jobDescription.roleTitle.trim() || null,
        }
      : null;

  return {
    status: "ready",
    error: null,
    // Callers that resume overwrite this with the payload's transcript; a
    // launch restored from localStorage has none.
    resumed: null,
    personaConfig: launch.personaConfig,
    scenarioValue: scenarioOverride ?? launch.scenarioValue,
    customScenarioBrief: launch.customScenarioBrief ?? "",
    streamResponses:
      streamOverride === null ? launch.streamResponses : streamOverride === "1",
    liveCoachingEnabled:
      launch.liveCoachingEnabled ?? DEFAULT.liveCoachingEnabled,
    interviewLoop: normalizeInterviewLoop(
      launch.interviewLoop,
      launch.practiceMode,
    ),
    sessionId: launch.sessionId,
    jobDescriptionTitle: jobDescriptionRef?.title ?? null,
    jobDescriptionRef,
    jobDescriptionMissing,
    voiceConfig: launch.voiceConfig,
  };
}

/**
 * Was this session set up with a job description that has since been deleted?
 *
 * Three sources disagree only in this one case. `launch_meta` is a snapshot of
 * the setup taken at launch and never revised; `session.jobDescriptionId` and
 * the live lookup are both current. Deleting a JD nulls the column (the FK is
 * `on delete set null`) and cascades its chunks, but leaves the snapshot naming
 * a document that no longer exists.
 *
 * Both current sources are checked rather than just the column, because they
 * fail independently: the column is null when the row is gone, and the lookup
 * returns null when the row is gone *or* unreadable. Requiring both to be empty
 * keeps this from firing on a transient read failure and wrongly telling a user
 * their JD was deleted.
 *
 * Exported for its test — the situation takes several minutes and a destructive
 * action to reproduce by hand, which is exactly the kind of path that rots.
 */
export function isJobDescriptionMissing(
  launch: SessionLaunchMeta | null,
  session: { jobDescriptionId: string | null },
  jobDescription: { id: string } | null,
): boolean {
  return isAttachmentMissing(
    launch?.jobDescription,
    session.jobDescriptionId,
    jobDescription,
  );
}

/** The same question for the CV, which fails the same way for the same reason. */
export function isResumeMissing(
  launch: SessionLaunchMeta | null,
  session: { resumeId: string | null },
  resume: { id: string } | null,
): boolean {
  return isAttachmentMissing(launch?.resume, session.resumeId, resume);
}

function isAttachmentMissing(
  snapshot: { enabled?: boolean; savedId?: string | null } | undefined,
  columnId: string | null,
  live: { id: string } | null,
): boolean {
  return Boolean(snapshot?.enabled && snapshot.savedId && !live && !columnId);
}

/**
 * Exported for its test. It is the only place the three sources of truth meet,
 * and its failure mode is silent: the wrong answer here shows a wrong toggle
 * rather than throwing.
 */
export function sessionRowToLaunch(
  session: {
    id: string;
    practiceMode: string;
    scenarioValue: string;
    scenarioDescription: string | null;
    personaConfig: PersonaConfig;
    jobDescriptionId: string | null;
    resumeId: string | null;
  },
  launch: SessionLaunchMeta | null,
  jobDescription: {
    id: string;
    title: string;
    roleTitle: string | null;
  } | null,
  resume: { id: string; title: string } | null,
): { launch: InterviewLaunchPayload; jobDescriptionMissing: boolean } {
  const jdEnabled = Boolean(session.jobDescriptionId || jobDescription);
  const resumeEnabled = Boolean(session.resumeId || resume);
  const resumeMissing = isResumeMissing(launch, session, resume);

  /**
   * The one place that sees all three sources of truth, and therefore the only
   * place the disagreement between them can be resolved.
   *
   * Correcting the snapshot here fixes three things at once, because everything
   * downstream flows through this return value: the chip stops asserting a JD
   * that is gone, `launchToBootstrap` produces a null `jobDescriptionRef`, and
   * `saveInterviewLaunch` stops writing the ghost back into localStorage where
   * it would resurface in "Edit setup" and in the next session launched.
   */
  const jobDescriptionMissing = isJobDescriptionMissing(
    launch,
    session,
    jobDescription,
  );

  const base: InterviewSetupState = {
    ...DEFAULT,
    scenarioValue: session.scenarioValue,
    customScenarioBrief:
      launch?.customScenarioBrief ??
      (session.scenarioValue === "custom"
        ? (session.scenarioDescription ?? "")
        : ""),
    streamResponses: launch?.streamResponses ?? DEFAULT.streamResponses,
    liveCoachingEnabled:
      launch?.liveCoachingEnabled ?? DEFAULT.liveCoachingEnabled,
    interviewLoop: normalizeInterviewLoop(
      launch?.interviewLoop,
      session.practiceMode === "voice" ? "voice" : "text",
    ),
    personaConfig: session.personaConfig,
    personaLibraryId: launch?.personaLibraryId,
    practiceMode: session.practiceMode === "voice" ? "voice" : "text",
    voiceConfig: launch?.voiceConfig ?? DEFAULT.voiceConfig,
    jobDescription: jobDescriptionMissing
      ? // Deleted out from under the session. Reset to "no JD" rather than
        // carrying the dead reference forward — the interview is genuinely
        // running without one from here on, and this is what makes that true
        // in the UI and in anything relaunched from this config.
        { ...DEFAULT.jobDescription, enabled: false }
      : (launch?.jobDescription ?? {
          ...DEFAULT.jobDescription,
          enabled: jdEnabled,
          savedId: jobDescription?.id ?? session.jobDescriptionId,
          savedTitle: jobDescription?.title ?? null,
          roleTitle: jobDescription?.roleTitle ?? "",
        }),
    /**
     * The CV was omitted here entirely.
     *
     * `base` spreads `...DEFAULT`, which carries `resume: { enabled: false }`,
     * and nothing overwrote it — so resuming a session showed the CV toggle off
     * while the server went on feeding `session.resumeId` into every turn. The
     * screen and the interview disagreed about whether a CV was attached, and
     * `saveInterviewLaunch` then wrote the "off" version back to localStorage.
     */
    resume: resumeMissing
      ? { ...DEFAULT.resume, enabled: false }
      : (launch?.resume ?? {
          ...DEFAULT.resume,
          enabled: resumeEnabled,
          savedId: resume?.id ?? session.resumeId,
          savedTitle: resume?.title ?? null,
        }),
  };

  return {
    launch: { ...base, sessionId: session.id },
    jobDescriptionMissing,
  };
}

export function useInterviewSessionBootstrap(
  searchParams: ReadonlyURLSearchParams,
  expectedMode: "text" | "voice",
): InterviewBootstrap {
  const [bootstrap, setBootstrap] = useState<InterviewBootstrap>(() => ({
    status: "loading",
    error: null,
    personaConfig: DEFAULT.personaConfig,
    scenarioValue: DEFAULT.scenarioValue,
    customScenarioBrief: "",
    streamResponses: DEFAULT.streamResponses,
    liveCoachingEnabled: DEFAULT.liveCoachingEnabled,
    interviewLoop: DEFAULT.interviewLoop,
    sessionId: null,
    jobDescriptionTitle: null,
    jobDescriptionRef: null,
    jobDescriptionMissing: false,
    voiceConfig: DEFAULT.voiceConfig,
    resumed: null,
  }));

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const resumeId = searchParams.get("session");

      if (resumeId) {
        try {
          const response = await fetch(
            `/api/sessions/${encodeURIComponent(resumeId)}/resume`,
            { cache: "no-store" },
          );
          const payload = await readJson<{
            session: Parameters<typeof sessionRowToLaunch>[0];
            launch: SessionLaunchMeta | null;
            jobDescription: {
              id: string;
              title: string;
              roleTitle: string | null;
            } | null;
            resume: { id: string; title: string } | null;
            messages?: Array<{
              id: string;
              role: string;
              content: string;
              createdAt: string;
            }>;
            turnAnalyses?: Array<{
              analysis: unknown;
              strategy?: string | null;
              confidence?: number | null;
            }>;
          }>(response);

          const { launch, jobDescriptionMissing } = sessionRowToLaunch(
            payload.session,
            payload.launch,
            payload.jobDescription,
            payload.resume ?? null,
          );

          if (launch.practiceMode !== expectedMode) {
            if (!cancelled) {
              setBootstrap((current) => ({
                ...current,
                status:
                  launch.practiceMode === "voice"
                    ? "redirect-voice"
                    : "redirect-setup",
              }));
            }
            return;
          }

          // `launch` is already reconciled, so a deleted JD is not written back.
          saveInterviewLaunch(launch);
          if (!cancelled) {
            setBootstrap({
              ...launchToBootstrap(launch, searchParams, jobDescriptionMissing),
              resumed: readResumedTranscript(payload),
            });
          }
          return;
        } catch (error) {
          if (!cancelled) {
            setBootstrap({
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to resume session.",
              personaConfig: DEFAULT.personaConfig,
              scenarioValue: DEFAULT.scenarioValue,
              customScenarioBrief: "",
              streamResponses: DEFAULT.streamResponses,
              liveCoachingEnabled: DEFAULT.liveCoachingEnabled,
              interviewLoop: DEFAULT.interviewLoop,
              sessionId: resumeId,
              jobDescriptionTitle: null,
              jobDescriptionRef: null,
              jobDescriptionMissing: false,
              voiceConfig: DEFAULT.voiceConfig,
              resumed: null,
            });
          }
          return;
        }
      }

      const launch = loadInterviewLaunch();
      if (!launch) {
        if (!cancelled) {
          setBootstrap((current) => ({
            ...current,
            status: "redirect-setup",
          }));
        }
        return;
      }

      if (launch.practiceMode !== expectedMode) {
        if (!cancelled) {
          setBootstrap((current) => ({
            ...current,
            status:
              launch.practiceMode === "voice"
                ? "redirect-voice"
                : "redirect-setup",
          }));
        }
        return;
      }

      if (!cancelled) {
        setBootstrap(launchToBootstrap(launch, searchParams));
      }
    };

    queueMicrotask(() => {
      if (!cancelled) {
        void run();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams, expectedMode]);

  return bootstrap;
}

export function scenarioFromBootstrap(bootstrap: InterviewBootstrap) {
  return getScenarioByValue(
    bootstrap.scenarioValue,
    bootstrap.customScenarioBrief,
  );
}
