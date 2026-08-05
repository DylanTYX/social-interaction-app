import type { AnalysisResult, InterviewStrategy } from "./responseAnalyzer";
import type { DecisionOutcome } from "./decisionEngine";

export type InterviewStage =
  | "intro"
  | "questioning"
  | "analysis"
  | "strategy"
  | "followup"
  | "wrap_up"
  | "report";

export interface InterviewTurn {
  id: string;
  stage: InterviewStage;
  userMessage: string;
  aiMessage?: string;
  strategy?: InterviewStrategy;
  analysis?: AnalysisResult;
  decision?: DecisionOutcome;
  timestamp: string;
}

export interface InterviewSessionState {
  sessionId: string;
  personaName: string;
  currentStage: InterviewStage;
  turnCount: number;
  followupCount: number;
  lastStrategy?: InterviewStrategy;
  lastQuestion?: string;
  lastAnalysis?: AnalysisResult;
  lastDecision?: DecisionOutcome;
  turns: InterviewTurn[];
  createdAt: string;
  updatedAt: string;
}

export interface InterviewTransitionInput {
  userMessage?: string;
  aiMessage?: string;
  question?: string;
  analysis?: AnalysisResult;
  decision?: DecisionOutcome;
}

export interface InterviewTransitionResult {
  state: InterviewSessionState;
}

function createTimestamp(): string {
  return new Date().toISOString();
}

function nextStageForCurrentStage(
  currentStage: InterviewStage,
  analysis?: AnalysisResult,
  decision?: DecisionOutcome,
): InterviewStage {
  if (currentStage === "intro") {
    return "questioning";
  }

  if (currentStage === "questioning") {
    return analysis ? "analysis" : "questioning";
  }

  if (currentStage === "analysis") {
    return decision ? "strategy" : "analysis";
  }

  if (currentStage === "strategy") {
    return decision && decision.strategy === "ACKNOWLEDGE_STRENGTH"
      ? "wrap_up"
      : "followup";
  }

  if (currentStage === "followup") {
    return "questioning";
  }

  return currentStage;
}

export function createInterviewSessionState(
  sessionId: string,
  personaName: string,
): InterviewSessionState {
  const now = createTimestamp();

  return {
    sessionId,
    personaName,
    currentStage: "intro",
    turnCount: 0,
    followupCount: 0,
    turns: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function recordInterviewTurn(
  state: InterviewSessionState,
  input: InterviewTransitionInput,
): InterviewTransitionResult {
  const nextStage = nextStageForCurrentStage(
    state.currentStage,
    input.analysis,
    input.decision,
  );

  const shouldGenerateFollowup =
    Boolean(input.decision) && nextStage === "followup";

  const turn: InterviewTurn = {
    id: `${state.sessionId}-${state.turnCount + 1}`,
    stage: state.currentStage,
    userMessage: input.userMessage ?? "",
    aiMessage: input.aiMessage,
    strategy: input.decision?.strategy,
    analysis: input.analysis,
    decision: input.decision,
    timestamp: createTimestamp(),
  };

  const updatedState: InterviewSessionState = {
    ...state,
    currentStage: nextStage,
    turnCount: state.turnCount + 1,
    followupCount: state.followupCount + (shouldGenerateFollowup ? 1 : 0),
    lastStrategy: input.decision?.strategy ?? state.lastStrategy,
    lastQuestion: input.question ?? state.lastQuestion,
    lastAnalysis: input.analysis ?? state.lastAnalysis,
    lastDecision: input.decision ?? state.lastDecision,
    turns: [...state.turns, turn],
    updatedAt: createTimestamp(),
  };

  return { state: updatedState };
}

export function isInterviewComplete(state: InterviewSessionState): boolean {
  return state.currentStage === "report" || state.turnCount >= 12;
}

export function markInterviewComplete(
  state: InterviewSessionState,
): InterviewSessionState {
  return {
    ...state,
    currentStage: "report",
    updatedAt: createTimestamp(),
  };
}
