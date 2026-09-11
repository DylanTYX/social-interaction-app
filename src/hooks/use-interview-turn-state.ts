"use client";

import { useCallback, useMemo, useState } from "react";

import type { ChatTurnResponse } from "@/lib/chat-contract";
import {
  createInterviewSessionState,
  interviewStage,
  recordInterviewTurn,
  type InterviewSessionState,
} from "@/lib/interview-session-state";
import {
  DEFAULT_TARGET_TURNS,
  isInterviewComplete,
} from "@/lib/interview-progress";
import {
  buildInterviewMetrics,
  type InterviewMetrics,
} from "@/lib/interview-metrics";
import {
  isInterviewStrategy,
  type AnalysisResult,
  type InterviewStrategy,
} from "@/lib/response-analyzer";
import {
  appendDimensionSnapshot,
  dimensionSnapshotFromAnalysis,
  type DimensionSnapshot,
} from "@/lib/session-launch-meta";
import { useActiveSessionTime } from "@/hooks/use-active-session-time";

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
  /** For the in-session progress indicator; includes turns restored on resume. */
  scoredTurns: number;
  targetTurns: number;
  stage: ReturnType<typeof interviewStage>;

  /**
   * Fold a scored turn in. Returns null for turns with no analysis — opening
   * turns and trivial answers — so callers can skip their own bookkeeping.
   */
  applyTurn: (turn: ChatTurnResponse) => AppliedTurn | null;

  /** Mark complete and persist final metrics. Returns the average score. */
  endSession: () => Promise<number | null>;
}

/**
 * Mirror progress to the session row.
 *
 * Best-effort by design: the report reads from Supabase, and a failed mirror
 * write must never interrupt an interview in progress. Only score metrics are
 * sent. `launch`, `loop` and `competencyCoverage` live in their own columns
 * since migration 0009, so this write cannot touch them.
 */
async function persistTurn(
  sessionId: string,
  input: {
    metrics: InterviewMetrics;
    snapshots: DimensionSnapshot[];
    /** Non-null marks the session finished, and adds status and endedAt. */
    completedAt: InterviewSessionState | null;
    /**
     * Sends the on-screen time counted since the last report. Awaited before a
     * completion write: the server turns the recorded total into the duration,
     * and stops accepting time once the session is completed.
     */
    flushActiveTime?: () => Promise<void>;
  },
): Promise<void> {
  const body: Record<string, unknown> = {
    averageScore: Number.isFinite(input.metrics.averageOverallScore)
      ? Math.round(input.metrics.averageOverallScore)
      : null,
    metrics: { ...input.metrics, dimensionSnapshots: input.snapshots },
  };

  if (input.completedAt) {
    body.status = "completed";
    body.endedAt = new Date().toISOString();
    // No duration: this hook's mount time is not when the interview started,
    // and the server derives it from the time the page was on screen.
    await input.flushActiveTime?.();
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
  /**
   * How many scored turns this round runs for, derived from its configured
   * duration. Sessions used to end at a flat 12 regardless.
   */
  targetTurns?: number;
  /** Restored from `interview_turn_analyses` when resuming. */
  initialAnalyses?: AnalysisResult[];
  /**
   * The interviewer's last decision before a reload. Persisted per turn all
   * along; the client simply never read it back.
   */
  initialDecision?: {
    strategy: string | null;
    confidence: number | null;
  } | null;
}): InterviewTurnState {
  const { sessionId, personaName } = input;
  const targetTurns = input.targetTurns ?? DEFAULT_TARGET_TURNS;

  const [sessionState, setSessionState] = useState<InterviewSessionState>(() =>
    createInterviewSessionState(sessionId ?? "local", personaName),
  );

  /**
   * The state with its real identity, derived rather than stored.
   *
   * The seed above runs on the *first* render, when bootstrap is still loading
   * — so the stored `sessionId` is always the `"local"` placeholder and the
   * stored `personaName` is always the pre-load default, for the whole life of
   * the session. Nothing updated them, and `buildInterviewMetrics` copies both
   * into the persisted `metrics` blob, so every session on record claimed to be
   * `"local"` with the default interviewer.
   *
   * Overlaid here rather than written back, because that is what it is:
   * identity is a function of the props, and only the counters and timestamps
   * are genuinely state.
   */
  const identifiedState = useMemo(
    () => ({
      ...sessionState,
      sessionId: sessionId ?? sessionState.sessionId,
      personaName,
    }),
    [sessionState, sessionId, personaName],
  );
  // Restored turns count toward the round's length. Without this a reload
  // restarted the counter at zero, so the interview ran its full length again
  // — and since the session id is now always in the URL, that happened on
  // every refresh, not just an explicit resume.
  const restoredTurns = input.initialAnalyses?.length ?? 0;
  // Addition, not `Math.max`. `sessionState` is seeded fresh on every mount, so
  // `turnCount` counts only the turns taken *since* the resume — the two
  // numbers are disjoint. Taking the larger of them meant that after resuming a
  // 6-of-8 session the total sat at 6, then 6, then 6… while the user answered,
  // so the progress display froze and the completion check never fired until
  // this mount's own counter independently reached the target. A resumed
  // interview ran its full length again.
  const scoredTurns = restoredTurns + sessionState.turnCount;
  const stage = interviewStage(
    { ...identifiedState, turnCount: scoredTurns },
    targetTurns,
  );
  // Counts while this screen is open and on screen, until the round ends; the
  // total becomes the session's duration. Both the text and voice screens get
  // it from here.
  const flushActiveTime = useActiveSessionTime(sessionId, stage !== "report");
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
  /**
   * Seeded from the restored turn, not left null.
   *
   * These are only ever written when a turn lands, so after a reload the state
   * panel rendered an empty decision history for a session that had six
   * follow-ups behind it, and the anti-repetition display had nothing to show
   * until the next answer.
   */
  const [lastStrategy, setLastStrategy] = useState<InterviewStrategy | null>(
    () => {
      const restoredStrategy = input.initialDecision?.strategy;
      return isInterviewStrategy(restoredStrategy) ? restoredStrategy : null;
    },
  );
  const [lastConfidence, setLastConfidence] = useState<number | null>(
    () => input.initialDecision?.confidence ?? null,
  );

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
    (turn: ChatTurnResponse) => {
      if (!turn.analysis || !turn.strategy) return null;

      const analysis = turn.analysis;
      const strategy = turn.strategy;
      const confidence = turn.confidence ?? 50;

      const advanced = recordInterviewTurn(identifiedState, {
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
      });

      const nextState = advanced;
      const nextAnalyses = [...effectiveAnalyses, analysis];
      const nextMetrics = {
        ...buildInterviewMetrics({
          analyses: nextAnalyses,
          state: nextState,
          restoredTurns,
        }),
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
      const complete = isInterviewComplete(
        restoredTurns + nextState.turnCount,
        targetTurns,
      );
      if (sessionId) {
        void persistTurn(sessionId, {
          metrics: nextMetrics,
          snapshots: nextSnapshots,
          completedAt: complete ? nextState : null,
          flushActiveTime,
        });
      }

      return { analysis, strategy, isComplete: complete };
    },
    [
      effectiveAnalyses,
      effectiveSnapshots,
      restoredTurns,
      sessionId,
      identifiedState,
      targetTurns,
      flushActiveTime,
    ],
  );

  const endSession = useCallback(async () => {
    const completedState = identifiedState;
    const finalMetrics = {
      ...buildInterviewMetrics({
        analyses: effectiveAnalyses,
        state: completedState,
        restoredTurns,
      }),
      sessionId: sessionId ?? completedState.sessionId,
    };
    const averageScore = effectiveAnalyses.length
      ? Math.round(finalMetrics.averageOverallScore)
      : null;

    // Only the manual "End session" button reaches this. The auto-complete
    // path must NOT call it: `applyTurn` already wrote the completion with the
    // turn included, and this callback is the one from the render *before*
    // `applyTurn`'s setState — closed over `effectiveAnalyses` and
    // `sessionState` that are missing the final turn. Calling both in one tick
    // sent the correct values fire-and-forget and the stale ones awaited, so
    // whichever landed last was genuinely nondeterministic and the report's
    // headline score wobbled between reloads.
    if (sessionId) {
      await persistTurn(sessionId, {
        metrics: finalMetrics,
        snapshots: effectiveSnapshots,
        completedAt: completedState,
        flushActiveTime,
      });
    }

    return averageScore;
  }, [
    effectiveAnalyses,
    effectiveSnapshots,
    sessionId,
    identifiedState,
    restoredTurns,
    flushActiveTime,
  ]);

  return {
    sessionState: identifiedState,
    targetTurns,
    scoredTurns,
    stage,
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
