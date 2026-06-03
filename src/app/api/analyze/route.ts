import { NextRequest, NextResponse } from "next/server";
import { analyzeResponse, type AnalysisResult } from "@/lib/responseAnalyzer";
import {
  decideInterviewAction,
  type DecisionContext,
} from "@/lib/decisionEngine";
import {
  buildFollowupPrompt,
  summarizeFollowup,
  type FollowupGenerationContext,
} from "@/lib/followupGenerator";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSession } from "@/lib/db/sessions";
import { parseSessionMetrics } from "@/lib/session-launch-meta";
import type { InterviewRoundType } from "@/lib/interview-rounds";
import {
  formatRetrievedJobContext,
  retrieveJobDescriptionChunks,
} from "@/lib/db/job-descriptions";

export const runtime = "nodejs";

interface AnalyzeResponseBody {
  analysis: AnalysisResult;
  strategy: string;
  decisionReason: string;
  confidence: number;
  followupPrompt: string;
  followupSummary: string;
  jobContextUsed?: boolean;
  error?: string;
  details?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AnalyzeResponseBody>> {
  try {
    const body = (await request.json()) as unknown;

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        {
          error: "Request body must be a JSON object",
        } as AnalyzeResponseBody,
        { status: 400 },
      );
    }

    const { candidateResponse, question, personaName, sessionId, roundType } =
      body as Record<string, unknown>;

    const candidateResponseStr =
      typeof candidateResponse === "string" ? candidateResponse.trim() : "";
    const questionStr = typeof question === "string" ? question.trim() : "";
    const personaNameStr =
      typeof personaName === "string" ? personaName.trim() : "";
    const sessionIdStr =
      typeof sessionId === "string" && sessionId.trim()
        ? sessionId.trim()
        : null;

    if (!candidateResponseStr || !questionStr || !personaNameStr) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: candidateResponse, question, personaName",
        } as AnalyzeResponseBody,
        { status: 400 },
      );
    }

    if (candidateResponseStr.length < 10) {
      return NextResponse.json(
        {
          error: "Candidate response too short (minimum 10 characters)",
        } as AnalyzeResponseBody,
        { status: 400 },
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        {
          error: "OpenAI API key not configured",
          details: "OPENAI_API_KEY environment variable is missing",
        } as AnalyzeResponseBody,
        { status: 500 },
      );
    }

    let jobContext: string | null = null;
    let resolvedRoundType =
      typeof roundType === "string" ? (roundType as InterviewRoundType) : undefined;

    if (sessionIdStr) {
      try {
        const { supabase, user } = await getCurrentUser();
        if (user) {
          const session = await getSession(supabase, sessionIdStr);
          if (session) {
            const metrics = parseSessionMetrics(session.metrics);
            if (!resolvedRoundType && metrics.launch?.interviewLoop.enabled) {
              resolvedRoundType =
                metrics.launch.interviewLoop.rounds[
                  metrics.launch.interviewLoop.currentRoundIndex
                ]?.type;
            }
          }
          if (session?.jobDescriptionId) {
            // Use the question + answer as the retrieval query so we pull
            // chunks that map to whatever was just discussed.
            const retrievalQuery = `${questionStr}\n${candidateResponseStr}`;
            const chunks = await retrieveJobDescriptionChunks({
              supabase,
              jobDescriptionId: session.jobDescriptionId,
              query: retrievalQuery,
              matchCount: 3,
            });
            jobContext = formatRetrievedJobContext(chunks);
          }
        }
      } catch (error) {
        // Retrieval failures should not block scoring; log and continue.
        console.warn("[/api/analyze] JD retrieval failed:", error);
      }
    }

    const analysis = await analyzeResponse(
      candidateResponseStr,
      questionStr,
      openaiApiKey,
      { jobContext, roundType: resolvedRoundType ?? "behavioral" },
    );

    const decisionContext: DecisionContext = {
      personaName: personaNameStr,
    };

    const decision = decideInterviewAction(analysis, decisionContext);

    const followupContext: FollowupGenerationContext = {
      personaName: personaNameStr,
      allowEscalation: decision.shouldEscalate,
      followupTopic: decision.nextFocus,
    };

    const followupPrompt = buildFollowupPrompt(
      decision.strategy,
      analysis,
      followupContext,
    );

    const followupSummary = summarizeFollowup(decision.strategy, analysis);

    return NextResponse.json({
      analysis,
      strategy: decision.strategy,
      decisionReason: decision.reason,
      confidence: decision.confidence,
      followupPrompt,
      followupSummary,
      jobContextUsed: Boolean(jobContext),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unexpected server error";

    console.error("Analysis error:", error);

    return NextResponse.json(
      {
        error: "Failed to analyze response",
        details: errorMessage,
      } as AnalyzeResponseBody,
      { status: 500 },
    );
  }
}
