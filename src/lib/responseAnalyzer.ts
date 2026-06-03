/**
 * Response Analysis Engine
 * Analyzes candidate responses using STAR methodology and other interview metrics
 * Provides structured feedback for decision engine and metrics tracking
 */

import { jsonrepair } from "jsonrepair";
import {
  ROUND_RUBRIC_LABELS,
  type InterviewRoundType,
} from "@/lib/interview-rounds";

/**
 * Scoring should be near-deterministic so the same answer doesn't swing
 * between, say, 68 and 81 across runs. We also default to the cheaper model
 * because the analyzer runs on every substantive turn; both are overridable
 * via env so quality/cost can be tuned without a code change.
 */
const ANALYZER_MODEL = process.env.ANALYZER_MODEL ?? "gpt-4o-mini";
const ANALYZER_TEMPERATURE = 0.1;

export interface STARAnalysis {
  situation: {
    present: boolean;
    quality: number; // 0-10
    context: string;
  };
  task: {
    present: boolean;
    quality: number; // 0-10
    clarity: string;
  };
  action: {
    present: boolean;
    quality: number; // 0-10
    specificity: number; // 0-10: how specific vs generic
    ownership: number; // 0-10: did they own the decision?
    summary: string;
  };
  result: {
    present: boolean;
    quality: number; // 0-10
    quantified: boolean; // did they use metrics/numbers?
    impact: string;
  };
}

export interface SpecificityMetrics {
  hasMetrics: boolean; // Did they mention numbers/data?
  metricCount: number;
  hasTimeframes: boolean; // Did they mention timelines?
  hasStakeholders: boolean; // Did they mention who was involved?
  vaguenessScore: number; // 0-10, where 10 = very vague
  concreteExamples: number; // Count of specific, real examples
}

export interface ConfidenceIndicators {
  hesitationMarkers: number; // Count: "I think", "maybe", "possibly"
  assertivenessScore: number; // 0-10: how confident/assertive
  qualificationCount: number; // Count: "but", "however", "however"
  revisionsCount: number; // Did they correct themselves?
  clarity: number; // 0-10: how clearly communicated
}

export interface ResponseQuality {
  length: number; // Word count
  isRelevant: boolean; // Addresses the question asked?
  addressesExplicitly: boolean; // Directly answers or deflects?
  depthLevel: "surface" | "moderate" | "deep"; // Superficial, standard, thorough
  thinkingVisible: boolean; // Did they show reasoning?
}

export interface TechnicalScores {
  problemFraming: number;
  approach: number;
  correctness: number;
  complexity: number;
  communication: number;
  edgeCases: number;
  codeQuality: number;
}

export interface AnalysisResult {
  overallScore: number; // 0-100
  roundType?: InterviewRoundType;
  starAnalysis: STARAnalysis;
  technicalScores?: TechnicalScores;
  specificityMetrics: SpecificityMetrics;
  confidenceIndicators: ConfidenceIndicators;
  responseQuality: ResponseQuality;
  strengths: string[];
  gaps: string[];
  followupTopics: string[];
  rawAnalysis: string; // Raw text from analyzer model
}

function extractJsonPayload(rawAnalysis: string): string {
  const trimmed = rawAnalysis.trim();

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

function parseAnalysisJson(rawAnalysis: string) {
  const payload = extractJsonPayload(rawAnalysis);

  try {
    return JSON.parse(payload) as AnalysisResult;
  } catch {
    const repaired = jsonrepair(payload);
    return JSON.parse(repaired) as AnalysisResult;
  }
}

export type InterviewStage =
  | "intro"
  | "questioning"
  | "analysis"
  | "strategy"
  | "followup"
  | "wrap_up"
  | "report";

export interface AnalyzeResponseOptions {
  /**
   * Optional role-context block (already formatted, e.g. via
   * `formatRetrievedJobContext`) inserted into the analysis prompt so the
   * analyzer can score against actual role requirements.
   */
  jobContext?: string | null;
  roundType?: InterviewRoundType;
}

function buildAnalysisPrompt(
  candidateResponse: string,
  question: string,
  jobContextBlock: string,
  roundType: InterviewRoundType,
): string {
  const rubric = ROUND_RUBRIC_LABELS[roundType];
  const useStar = roundType === "behavioral" || roundType === "screening";

  const technicalBlock =
    roundType === "technical_swe" ||
    roundType === "system_design" ||
    roundType === "case"
      ? `,
  "technicalScores": {
    "problemFraming": number (0-10),
    "approach": number (0-10),
    "correctness": number (0-10),
    "complexity": number (0-10),
    "communication": number (0-10),
    "edgeCases": number (0-10),
    "codeQuality": number (0-10)
  }`
      : "";

  const starBlock = useStar
    ? `"starAnalysis": {
    "situation": { "present": boolean, "quality": number (0-10), "context": "brief description" },
    "task": { "present": boolean, "quality": number (0-10), "clarity": "brief description" },
    "action": {
      "present": boolean,
      "quality": number (0-10),
      "specificity": number (0-10),
      "ownership": number (0-10),
      "summary": "brief description"
    },
    "result": {
      "present": boolean,
      "quality": number (0-10),
      "quantified": boolean,
      "impact": "brief description"
    }
  },`
    : `"starAnalysis": {
    "situation": { "present": false, "quality": 0, "context": "not primary rubric" },
    "task": { "present": false, "quality": 0, "clarity": "not primary rubric" },
    "action": { "present": false, "quality": 0, "specificity": 0, "ownership": 0, "summary": "not primary rubric" },
    "result": { "present": false, "quality": 0, "quantified": false, "impact": "not primary rubric" }
  },`;

  return `You are an expert interview analyst. Score the candidate response for a ${roundType} interview round.
Primary rubric: ${rubric}.
Do not use STAR as the primary rubric unless this is behavioral or screening.${jobContextBlock}

QUESTION ASKED:
${question}

CANDIDATE RESPONSE:
${candidateResponse}

Return ONLY valid JSON with this structure:
{
  ${starBlock}
  ${technicalBlock}
  "specificityMetrics": {
    "hasMetrics": boolean,
    "metricCount": number,
    "hasTimeframes": boolean,
    "hasStakeholders": boolean,
    "vaguenessScore": number (0-10, 10=vague),
    "concreteExamples": number
  },
  "confidenceIndicators": {
    "hesitationMarkers": number,
    "assertivenessScore": number (0-10),
    "qualificationCount": number,
    "revisionsCount": number,
    "clarity": number (0-10)
  },
  "responseQuality": {
    "length": number,
    "isRelevant": boolean,
    "addressesExplicitly": boolean,
    "depthLevel": "surface" | "moderate" | "deep",
    "thinkingVisible": boolean
  },
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "followupTopics": ["topic1", "topic2"],
  "overallScore": number (0-100)
}

Include at least one genuine strength when present. Keep strengths and gaps balanced.`;
}

/**
 * Perform STAR analysis on candidate response
 * This is the core analysis function
 */
export async function analyzeResponse(
  candidateResponse: string,
  question: string,
  openaiApiKey: string,
  options: AnalyzeResponseOptions = {},
): Promise<AnalysisResult> {
  const jobContextBlock =
    options.jobContext && options.jobContext.trim().length > 0
      ? `\n\nROLE CONTEXT (use this to judge how the response maps to required competencies, but do NOT invent details that are not in the response):\n${options.jobContext.trim()}`
      : "";

  const roundType = options.roundType ?? "behavioral";
  const analysisPrompt = buildAnalysisPrompt(
    candidateResponse,
    question,
    jobContextBlock,
    roundType,
  );

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: ANALYZER_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert interview analyst. You score candidate responses precisely and consistently, and you always reply with a single valid JSON object and nothing else.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        temperature: ANALYZER_TEMPERATURE,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`,
      );
    }

    const result = await response.json();
    const rawAnalysis = result.choices[0].message.content;

    // Parse the JSON response
    let analysisData;
    try {
      analysisData = parseAnalysisJson(rawAnalysis);
    } catch {
      throw new Error(
        `Failed to parse analyzer response as JSON: ${rawAnalysis}`,
      );
    }

    return {
      overallScore: analysisData.overallScore,
      roundType,
      starAnalysis: analysisData.starAnalysis,
      technicalScores: analysisData.technicalScores,
      specificityMetrics: analysisData.specificityMetrics,
      confidenceIndicators: analysisData.confidenceIndicators,
      responseQuality: analysisData.responseQuality,
      strengths: analysisData.strengths,
      gaps: analysisData.gaps,
      followupTopics: analysisData.followupTopics,
      rawAnalysis,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during analysis";
    throw new Error(`Response analysis failed: ${errorMessage}`);
  }
}

/**
 * Determine interview strategy based on analysis
 * Returns which follow-up approach to take
 */
export type InterviewStrategy =
  | "CLARIFY_SITUATION"
  | "PROBE_ACTION"
  | "CHALLENGE_OWNERSHIP"
  | "EXPLORE_RESULT"
  | "ACKNOWLEDGE_STRENGTH"
  | "DRILL_SPECIFICITY"
  | "ASSESS_THINKING";

export function determineStrategy(analysis: AnalysisResult): InterviewStrategy {
  const { starAnalysis, specificityMetrics } = analysis;

  // If situation/task missing, probe for context
  if (!starAnalysis.situation.present || !starAnalysis.task.present) {
    return "CLARIFY_SITUATION";
  }

  // If action details are vague, probe deeper
  if (starAnalysis.action.specificity < 4) {
    return "DRILL_SPECIFICITY";
  }

  // If ownership is low, challenge decisions
  if (starAnalysis.action.ownership < 5) {
    return "CHALLENGE_OWNERSHIP";
  }

  // If result missing or not quantified, explore impact
  if (!starAnalysis.result.present || !starAnalysis.result.quantified) {
    return "EXPLORE_RESULT";
  }

  // If vague overall, drill into specificity
  if (specificityMetrics.vaguenessScore > 6) {
    return "DRILL_SPECIFICITY";
  }

  // If strong response, acknowledge and probe deeper thinking
  if (analysis.overallScore > 75) {
    return "ACKNOWLEDGE_STRENGTH";
  }

  // Default: probe what they did
  return "PROBE_ACTION";
}

/**
 * Generate follow-up prompt based on strategy and analysis
 */
export function generateFollowupPrompt(
  strategy: InterviewStrategy,
  analysis: AnalysisResult,
  personaName: string,
): string {
  const base = `Based on the candidate's response, here's a follow-up to dig deeper as ${personaName}:`;

  const followupMap: Record<InterviewStrategy, (a: AnalysisResult) => string> =
    {
      CLARIFY_SITUATION: () =>
        `${base}\n"Can you walk me back to the beginning? I want to understand the exact situation you were in. What was the context? Who were the key players? What prompted you to take action?"`,

      PROBE_ACTION: () =>
        `${base}\n"That's helpful. Now I'm curious about the specifics of what you did. Walk me through the exact steps you took. What was your first action? Then what?"`,

      CHALLENGE_OWNERSHIP: () =>
        `${base}\n"I hear that. But I want to understand your personal role in this. What specifically did YOU decide to do? What was in your control versus what wasn't?"`,

      EXPLORE_RESULT: () =>
        `${base}\n"So you did all that work. But what actually happened? Did it work? How do you know? What metrics or feedback did you get that showed the impact?"`,

      ACKNOWLEDGE_STRENGTH: () =>
        `${base}\n"That's a really thoughtful approach. I like how you handled that. But take me deeper—what was the hardest part of executing that? How did you overcome obstacles?"`,

      DRILL_SPECIFICITY: (a) =>
        `${base}\n"I'm getting the general picture, but I need more specifics. When you say '${a.starAnalysis.action.summary.split(" ").slice(0, 3).join(" ")}'... exactly what did that look like? Give me a concrete example."`,

      ASSESS_THINKING: () =>
        `${base}\n"I'm trying to understand how you think about these problems. Walk me through your decision-making process. What factors did you weigh? What trade-offs did you consider?"`,
    };

  return followupMap[strategy](analysis);
}

/**
 * Calculate a trend if multiple responses are provided
 */
export interface TrendAnalysis {
  responseCount: number;
  averageSTARScore: number; // Average of STAR component scores
  specificityTrend: "improving" | "declining" | "stable";
  confidenceTrend: "increasing" | "decreasing" | "stable";
  averageOverallScore: number;
}

export function analyzeTrend(analyses: AnalysisResult[]): TrendAnalysis {
  if (analyses.length === 0) {
    return {
      responseCount: 0,
      averageSTARScore: 0,
      specificityTrend: "stable",
      confidenceTrend: "stable",
      averageOverallScore: 0,
    };
  }

  const avgOverall =
    analyses.reduce((sum, a) => sum + a.overallScore, 0) / analyses.length;

  const avgSTAR =
    analyses.reduce((sum, a) => {
      const starAvg =
        (a.starAnalysis.situation.quality +
          a.starAnalysis.task.quality +
          a.starAnalysis.action.quality +
          a.starAnalysis.result.quality) /
        4;
      return sum + starAvg;
    }, 0) / analyses.length;

  // Determine trends
  let specificityTrend: "improving" | "declining" | "stable" = "stable";
  let confidenceTrend: "increasing" | "decreasing" | "stable" = "stable";

  if (analyses.length >= 2) {
    const specificityScores = analyses.map(
      (a) => a.specificityMetrics.vaguenessScore,
    );
    const confidenceScores = analyses.map(
      (a) => a.confidenceIndicators.assertivenessScore,
    );

    // If vagueness is decreasing (lower is better), specificity is improving
    if (specificityScores[0] > specificityScores[analyses.length - 1] + 1) {
      specificityTrend = "improving";
    } else if (
      specificityScores[0] <
      specificityScores[analyses.length - 1] - 1
    ) {
      specificityTrend = "declining";
    }

    // If assertiveness is increasing, confidence is increasing
    if (confidenceScores[0] < confidenceScores[analyses.length - 1] - 1) {
      confidenceTrend = "increasing";
    } else if (
      confidenceScores[0] >
      confidenceScores[analyses.length - 1] + 1
    ) {
      confidenceTrend = "decreasing";
    }
  }

  return {
    responseCount: analyses.length,
    averageSTARScore: avgSTAR,
    specificityTrend,
    confidenceTrend,
    averageOverallScore: avgOverall,
  };
}
