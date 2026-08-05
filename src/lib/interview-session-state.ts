import type { DecisionOutcome } from "./decision-engine";
import type { AnalysisResult, InterviewStrategy } from "./response-analyzer";

/**
 * The running record of an interview session, client-side.
 *
 * This replaces `interview-state-machine.ts`, which modelled a seven-stage
 * graph that nothing ever branched on — no server code imported it, and its
 * only consumers rendered `currentStage` as a label. The graph was also broken:
 * `wrap_up` had no outgoing transition, so a candidate who scored well once was
 * pinned there and the label lied for the rest of the session.
 *
 * The stage is now *derived* from how far through the interview we are, so it
 * cannot get stuck and cannot disagree with the end condition.
 */

export type InterviewStage = "intro" | "questioning" | "wrap_up" | "report";

export interface InterviewSessionState {
  sessionId: string;
  personaName: string;
  /** Substantive, scored exchanges. Trivial replies do not count. */
  turnCount: number;
  followupCount: number;
  lastStrategy?: InterviewStrategy;
  lastQuestion?: string;
  lastAnalysis?: AnalysisResult;
  lastDecision?: DecisionOutcome;
  createdAt: string;
  updatedAt: string;
}

export interface RecordTurnInput {
  question?: string;
  analysis?: AnalysisResult;
  decision?: DecisionOutcome;
}

function now(): string {
  return new Date().toISOString();
}

export function createInterviewSessionState(
  sessionId: string,
  personaName: string,
): InterviewSessionState {
  const timestamp = now();
  return {
    sessionId,
    personaName,
    turnCount: 0,
    followupCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function recordInterviewTurn(
  state: InterviewSessionState,
  input: RecordTurnInput,
): InterviewSessionState {
  // A follow-up is a turn where the decision engine chose to dig into the
  // previous answer rather than open a new thread.
  const isFollowup =
    input.decision !== undefined &&
    input.decision.strategy !== "ACKNOWLEDGE_STRENGTH";

  return {
    ...state,
    turnCount: state.turnCount + 1,
    followupCount: state.followupCount + (isFollowup ? 1 : 0),
    lastStrategy: input.decision?.strategy ?? state.lastStrategy,
    lastQuestion: input.question ?? state.lastQuestion,
    lastAnalysis: input.analysis ?? state.lastAnalysis,
    lastDecision: input.decision ?? state.lastDecision,
    updatedAt: now(),
  };
}

/**
 * Where we are, derived rather than stored. `targetTurns` comes from the
 * round's configured length (see `interview-progress.ts`).
 */
export function interviewStage(
  state: InterviewSessionState,
  targetTurns: number,
): InterviewStage {
  if (state.turnCount === 0) return "intro";
  if (state.turnCount >= targetTurns) return "report";
  // The last couple of exchanges are where an interviewer starts closing out.
  if (state.turnCount >= targetTurns - 2) return "wrap_up";
  return "questioning";
}
