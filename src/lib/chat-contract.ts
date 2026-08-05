import type { MicroFeedbackResult } from "@/lib/micro-feedback";
import type {
  AnalysisResult,
  InterviewStrategy,
} from "@/lib/responseAnalyzer";

/**
 * The `/api/chat` wire contract.
 *
 * Declared once and imported by the route and both interview screens. It used
 * to be written out three times — and had already drifted: the voice copy was
 * missing `microFeedback`, so the server computed a coaching hint on every
 * voice turn and the client silently dropped it.
 */
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

/** Error shape the route returns on failure. */
export interface ChatTurnError {
  error?: string;
  details?: string;
}
