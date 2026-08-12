"use client";

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
    voiceConfig: launch.voiceConfig,
  };
}

function sessionRowToLaunch(
  session: {
    id: string;
    practiceMode: string;
    scenarioValue: string;
    scenarioDescription: string | null;
    personaConfig: PersonaConfig;
    jobDescriptionId: string | null;
  },
  launch: SessionLaunchMeta | null,
  jobDescription: {
    id: string;
    title: string;
    roleTitle: string | null;
  } | null,
): InterviewLaunchPayload {
  const jdEnabled = Boolean(session.jobDescriptionId || jobDescription);
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
    jobDescription: launch?.jobDescription ?? {
      ...DEFAULT.jobDescription,
      enabled: jdEnabled,
      savedId: jobDescription?.id ?? session.jobDescriptionId,
      savedTitle: jobDescription?.title ?? null,
      roleTitle: jobDescription?.roleTitle ?? "",
    },
  };

  return { ...base, sessionId: session.id };
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
          if (!response.ok) {
            throw new Error("Could not resume this session.");
          }
          const payload = (await response.json()) as {
            session: Parameters<typeof sessionRowToLaunch>[0];
            launch: SessionLaunchMeta | null;
            jobDescription: {
              id: string;
              title: string;
              roleTitle: string | null;
            } | null;
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
          };

          const launch = sessionRowToLaunch(
            payload.session,
            payload.launch,
            payload.jobDescription,
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

          saveInterviewLaunch(launch);
          if (!cancelled) {
            setBootstrap({
              ...launchToBootstrap(launch, searchParams),
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
