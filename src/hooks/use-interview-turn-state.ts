"use client";

import { useCallback, useMemo, useState } from "react";

import type { ChatTurnResponse } from "@/lib/chat-contract";
import {
  createInterviewSessionState,
  isInterviewComplete,
  markInterviewComplete,
  recordInterviewTurn,
  type InterviewSessionState,
} from "@/lib/interview-state-machine";
import {
  buildInterviewMetrics,
  type InterviewMetrics,
} from "@/lib/interview-metrics";
import type {
  AnalysisResult,
  InterviewStrategy,
} from "@/lib/response-analyzer";
import {
  appendDimensionSnapshot,
  dimensionSnapshotFromAnalysis,
  type DimensionSnapshot,
} from "@/lib/session-launch-meta";

/**
 * Scored-turn bookkeeping for an interview session.
 *
 * The text and voice screens each carried their own copy of this — same state,
 * same reducer logic, same PATCH bodies, right down to identical comments. The
 * copies had already drifted in ways that mattered: voice never recorded
 * dimension snapshots (so the analytics chart was text-only), never wrote a
 * per-turn score (so an abandoned voice session showed `null` forever), and
 * never surfaced micro-feedback. Owning it once means both screens get the same
 * behaviour by construction rather than by remembering to copy the next fix.
 *
 * The persistence PATCH is fire-and-forget: the report reads from Supabase, and
 * a failed mirror write must never interrupt an interview in progress.
 */

export interface AppliedTurn {
  analysis: AnalysisResult;
  strategy: InterviewStrategy;
  isComplete: boolean;
}

export interface InterviewTurnState {
  sessionState: InterviewSessionState;
  analyses: AnalysisResult[];
  metrics: InterviewMetrics | null;
  lastFollowupPrompt: string | null;
  lastDecisionReason: string | null;
  lastStrategy: InterviewStrategy | null;
  lastConfidence: number | null;

  /**
   * Fold a scored turn in. Returns null for turns with no analysis — opening
   * turns and trivial answers — so callers can skip their own bookkeeping.
   */
  applyTurn: (
    turn: ChatTurnResponse,
    context: { userMessage: string },
  ) => AppliedTurn | null;

  /** Mark complete and persist final metrics. Returns the average score. */
  endSession: () => Promise<number | null>;
}

/**
 * Mirror progress to the session row.
 *
 * Best-effort by design: the report reads from Supabase, and a failed mirror
 * write must never interrupt an interview in progress. Only score metrics are
 * sent — `launch`, `loop` and `competencyCoverage` are server-owned, and the
 * server merges these keys over what it already stored.
 */
async function persistTurn(
  sessionId: string,
  input: {
    metrics: InterviewMetrics;
    snapshots: DimensionSnapshot[];
    /** Non-null marks the session finished, and adds status/duration/endedAt. */
    completedAt: InterviewSessionState | null;
  },
): Promise<void> {
  const body: Record<string, unknown> = {
    averageScore: Number.isFinite(input.metrics.averageOverallScore)
      ? Math.round(input.metrics.averageOverallScore)
      : null,
    metrics: { ...input.metrics, dimensionSnapshots: input.snapshots },
  };

  if (input.completedAt) {
    const startedAtMs = Date.parse(input.completedAt.createdAt);
    body.status = "completed";
    body.endedAt = new Date().toISOString();
    body.durationMinutes = Number.isFinite(startedAtMs)
      ? Math.max(1, Math.round((Date.now() - startedAtMs) / 60000))
      : null;
  }

  try {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Best-effort mirror.
  }
}

export function useInterviewTurnState(input: {
  sessionId: string | null;
  personaName: string;
  /** Restored from `interview_turn_analyses` when resuming. */
  initialAnalyses?: AnalysisResult[];
}): InterviewTurnState {
  const { sessionId, personaName } = input;

  const [sessionState, setSessionState] = useState<InterviewSessionState>(() =>
    createInterviewSessionState(sessionId ?? "local", personaName),
  );
  const [analyses, setAnalyses] = useState<AnalysisResult[]>(
    input.initialAnalyses ?? [],
  );
  const [metrics, setMetrics] = useState<InterviewMetrics | null>(null);
  const [snapshots, setSnapshots] = useState<DimensionSnapshot[]>([]);
  const [lastFollowupPrompt, setLastFollowupPrompt] = useState<string | null>(
    null,
  );
  const [lastDecisionReason, setLastDecisionReason] = useState<string | null>(
    null,
  );
  const [lastStrategy, setLastStrategy] = useState<InterviewStrategy | null>(
    null,
  );
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);

  // Restored history arrives asynchronously — after this hook's first render —
  // so it cannot be a `useState` initial value and does not need an effect to
  // adopt it either. Derive instead: use our own history once we have one,
  // otherwise whatever was restored. Snapshots are a pure function of the
  // analyses, so rebuilding them beats persisting them separately; without
  // this the first post-resume turn overwrites the stored array with a single
  // element, because session metrics merge shallowly.
  const restored = input.initialAnalyses;
  const effectiveAnalyses = useMemo(
    () => (analyses.length > 0 ? analyses : (restored ?? [])),
    [analyses, restored],
  );
  const effectiveSnapshots = useMemo(
    () =>
      snapshots.length > 0
        ? snapshots
        : effectiveAnalyses.map(dimensionSnapshotFromAnalysis),
    [snapshots, effectiveAnalyses],
  );

  const applyTurn = useCallback(
    (turn: ChatTurnResponse, context: { userMessage: string }) => {
      if (!turn.analysis || !turn.strategy) return null;

      const analysis = turn.analysis;
      const strategy = turn.strategy;
      const confidence = turn.confidence ?? 50;

      const advanced = recordInterviewTurn(sessionState, {
        userMessage: context.userMessage,
        aiMessage: turn.aiMessage,
        question: turn.aiMessage,
        analysis,
        decision: {
          strategy,
          reason: turn.decisionReason ?? "",
          confidence,
          // The server's own verdict. Re-deriving it from `confidence` used a
          // different rule than `decideInterviewAction` and disagreed with it.
          shouldEscalate: turn.shouldEscalate ?? false,
          shouldSlowDown: turn.shouldSlowDown ?? false,
          nextFocus: analysis.followupTopics?.[0] ?? "specific examples",
        },
      }).state;

      const nextState = isInterviewComplete(advanced)
        ? markInterviewComplete(advanced)
        : advanced;
      const nextAnalyses = [...effectiveAnalyses, analysis];
      const nextMetrics = {
        ...buildInterviewMetrics({ analyses: nextAnalyses, state: nextState }),
        // The real id is not known when this hook first renders.
        sessionId: sessionId ?? nextState.sessionId,
      };
      const nextSnapshots =
        appendDimensionSnapshot(
          { dimensionSnapshots: effectiveSnapshots },
          analysis,
        ).dimensionSnapshots ?? [];

      setSessionState(nextState);
      setAnalyses(nextAnalyses);
      setMetrics(nextMetrics);
      setSnapshots(nextSnapshots);
      setLastFollowupPrompt(turn.followupSummary);
      setLastDecisionReason(turn.decisionReason);
      setLastStrategy(strategy);
      setLastConfidence(confidence);

      // One writer for `averageScore`. The text screen used to have two — a
      // per-turn write of this turn's raw score, and an effect writing the
      // running mean — racing on every turn.
      //
      // The completion write also happens here rather than via `endSession`,
      // because a caller that finishes the interview calls both in the same
      // tick: `endSession` would still be closed over the *pre-turn* state and
      // would overwrite this turn's score with the previous mean.
      const complete = isInterviewComplete(nextState);
      if (sessionId) {
        void persistTurn(sessionId, {
          metrics: nextMetrics,
          snapshots: nextSnapshots,
          completedAt: complete ? nextState : null,
        });
      }

      return { analysis, strategy, isComplete: complete };
    },
    [effectiveAnalyses, effectiveSnapshots, sessionId, sessionState],
  );

  const endSession = useCallback(async () => {
    const completedState = markInterviewComplete(sessionState);
    const finalMetrics = {
      ...buildInterviewMetrics({
        analyses: effectiveAnalyses,
        state: completedState,
      }),
      sessionId: sessionId ?? completedState.sessionId,
    };
    const averageScore = effectiveAnalyses.length
      ? Math.round(finalMetrics.averageOverallScore)
      : null;

    if (sessionId) {
      await persistTurn(sessionId, {
        metrics: finalMetrics,
        snapshots: effectiveSnapshots,
        completedAt: completedState,
      });
    }

    return averageScore;
  }, [effectiveAnalyses, effectiveSnapshots, sessionId, sessionState]);

  return {
    sessionState,
    analyses: effectiveAnalyses,
    metrics,
    lastFollowupPrompt,
    lastDecisionReason,
    lastStrategy,
    lastConfidence,
    applyTurn,
    endSession,
  };
}
