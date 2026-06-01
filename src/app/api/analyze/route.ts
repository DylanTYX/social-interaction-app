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

export const runtime = "nodejs";

interface AnalyzeResponseBody {
  analysis: AnalysisResult;
  strategy: string;
  decisionReason: string;
  confidence: number;
  followupPrompt: string;
  followupSummary: string;
  error?: string;
  details?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AnalyzeResponseBody>> {
  try {
    const body = (await request.json()) as unknown;

    // Validate request body
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        {
          error: "Request body must be a JSON object",
        } as AnalyzeResponseBody,
        { status: 400 },
      );
    }

    const { candidateResponse, question, personaName } = body as Record<
      string,
      unknown
    >;

    // Validate required fields
    const candidateResponseStr =
      typeof candidateResponse === "string" ? candidateResponse.trim() : "";
    const questionStr = typeof question === "string" ? question.trim() : "";
    const personaNameStr =
      typeof personaName === "string" ? personaName.trim() : "";

    if (!candidateResponseStr || !questionStr || !personaNameStr) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: candidateResponse, question, personaName",
        } as AnalyzeResponseBody,
        { status: 400 },
      );
    }

    // Validate minimum lengths
    if (candidateResponseStr.length < 10) {
      return NextResponse.json(
        {
          error: "Candidate response too short (minimum 10 characters)",
        } as AnalyzeResponseBody,
        { status: 400 },
      );
    }

    // Get OpenAI API key from environment
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

    // Perform analysis
    const analysis = await analyzeResponse(
      candidateResponseStr,
      questionStr,
      openaiApiKey,
    );

    const decisionContext: DecisionContext = {
      personaName: personaNameStr,
    };

    // Determine interview strategy
    const decision = decideInterviewAction(analysis, decisionContext);

    // Generate follow-up prompt
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
