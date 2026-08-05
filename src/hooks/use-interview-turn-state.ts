"use client";

import { useCallback, useEffect, useState } from "react";

import type { ChatTurnResponse } from "@/lib/chat-contract";
import {
  createInterviewSessionState,
  isInterviewComplete,
  markInterviewComplete,
  recordInterviewTurn,
  type InterviewSessionState,
} from "@/lib/interviewStateMachine";
import {
  buildInterviewMetrics,
  type InterviewMetrics,
} from "@/lib/metricsTracker";
import type {
  AnalysisResult,
  InterviewStrategy,
} from "@/lib/responseAnalyzer";
import {
  appendDimensionSnapshot,
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
  strategies: InterviewStrategy[];
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
  const [strategies, setStrategies] = useState<InterviewStrategy[]>([]);
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

  // The session id is not known on first render — `useInterviewSessionBootstrap`
  // resolves it a tick later — so adopt it once it arrives. Metrics carry the
  // id, and without this they would be stamped with the placeholder.
  useEffect(() => {
    if (!sessionId) return;
    setSessionState((current) =>
      current.sessionId === sessionId ? current : { ...current, sessionId },
    );
  }, [sessionId]);

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
      const nextAnalyses = [...analyses, analysis];
      const nextMetrics = buildInterviewMetrics({
        analyses: nextAnalyses,
        state: nextState,
      });
      const nextSnapshots =
        appendDimensionSnapshot({ dimensionSnapshots: snapshots }, analysis)
          .dimensionSnapshots ?? [];

      setSessionState(nextState);
      setAnalyses(nextAnalyses);
      setStrategies((current) => [...current, strategy]);
      setMetrics(nextMetrics);
      setSnapshots(nextSnapshots);
      setLastFollowupPrompt(turn.followupSummary);
      setLastDecisionReason(turn.decisionReason);
      setLastStrategy(strategy);
      setLastConfidence(confidence);

      // One writer for `averageScore`. The text screen used to have two — a
      // per-turn write of this turn's raw score, and an effect writing the
      // running mean — racing on every turn, so the stored value was whichever
      // request happened to land last.
      if (sessionId) {
        void fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            averageScore: Math.round(nextMetrics.averageOverallScore),
            metrics: { ...nextMetrics, dimensionSnapshots: nextSnapshots },
          }),
        }).catch(() => {
          // Best-effort mirror; the report reads from Supabase directly.
        });
      }

      return { analysis, strategy, isComplete: isInterviewComplete(nextState) };
    },
    [analyses, sessionId, sessionState, snapshots],
  );

  const endSession = useCallback(async () => {
    const completedState = markInterviewComplete(sessionState);
    const finalMetrics = buildInterviewMetrics({
      analyses,
      state: completedState,
    });
    const averageScore = analyses.length
      ? Math.round(finalMetrics.averageOverallScore)
      : null;

    if (!sessionId) return averageScore;

    const startedAtMs = Date.parse(sessionState.createdAt);
    const durationMinutes = Number.isFinite(startedAtMs)
      ? Math.max(1, Math.round((Date.now() - startedAtMs) / 60000))
      : null;

    try {
      // Only the score metrics are sent. `launch`, `loop` and
      // `competencyCoverage` are server-owned; the server merges these keys
      // over what it already stored.
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          averageScore,
          durationMinutes,
          metrics: { ...finalMetrics, dimensionSnapshots: snapshots },
          endedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Best-effort; the user is still routed to their report.
    }

    return averageScore;
  }, [analyses, sessionId, sessionState, snapshots]);

  return {
    sessionState,
    analyses,
    strategies,
    metrics,
    lastFollowupPrompt,
    lastDecisionReason,
    lastStrategy,
    lastConfidence,
    applyTurn,
    endSession,
  };
}
