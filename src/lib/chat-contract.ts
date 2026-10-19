import type { MicroFeedbackResult } from "@/lib/micro-feedback";
import type {
  AnalysisResult,
  InterviewStrategy,
} from "@/lib/response-analyzer";

/**
 * The `/api/chat` wire contract.
 *
 * Declared once and imported by the route and both interview screens. It used
 * to be written out three times — and had already drifted: the voice copy was
 * missing `microFeedback`, so the server computed a coaching hint on every
 * voice turn and the client silently dropped it.
 */
/**
 * Submitted when a response timer expires with nothing written or said.
 *
 * Shared, because it was written out five times — and because the *server* has
 * to recognise it. At 43 characters it cleared `isTrivialAnswer`'s ten-character
 * floor, so a candidate who walked away got a full scoring call on the
 * placeholder itself, and whatever score the model invented for it was
 * persisted and shown in the report as a real answer.
 */
export const NO_RESPONSE_MESSAGE =
  "[No response submitted before time expired.]";

/**
 * Appended to a code answer that was sent because its clock ran out.
 *
 * The code itself is still the answer — a partial solution tells the report
 * more than nothing — but without a marker the interviewer read it as finished
 * work and moved on, so the candidate never got the moment every real coding
 * interview has: "we're at time, walk me through where you got to". The server
 * recognises this line and steers that reply (`isTimedOutCodeAnswer`).
 */
export const CODE_TIME_UP_NOTE = "[Time ran out — this is the code so far.]";

/** Whether an answer is a code answer the timer sent unfinished. */
export function isTimedOutCodeAnswer(message: string): boolean {
  return message.trimEnd().endsWith(CODE_TIME_UP_NOTE);
}

export interface ChatTurnResponse {
  aiMessage: string;
  turnCount: number;
  summary: string | null;

  /**
   * Analysis of the user's latest answer. Null on opening turns and trivial
   * answers ("yes", "ready"), which are not worth a scoring call.
   */
  analysis: AnalysisResult | null;
  strategy: InterviewStrategy | null;
  decisionReason: string | null;
  confidence: number | null;

  /**
   * The server's own escalation verdict, not something for the client to
   * re-derive. Clients previously guessed from `confidence` thresholds using
   * different logic from `decideInterviewAction`, and the two disagreed.
   */
  shouldEscalate: boolean | null;
  shouldSlowDown: boolean | null;

  followupSummary: string | null;

  /** One-line coaching hint, derived from the analysis above. */
  microFeedback: MicroFeedbackResult | null;
}
