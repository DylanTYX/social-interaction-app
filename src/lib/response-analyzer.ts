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
import type { UsageCollector } from "@/lib/api/token-usage";
import { parseCodeAnswer } from "@/lib/code-answer";
import { analyzeText } from "@/lib/text-metrics";
import { isTechnicalRound } from "@/lib/round-types";

/**
 * Scoring should be near-deterministic so the same answer doesn't swing
 * between, say, 68 and 81 across runs. We also default to the cheaper model
 * because the analyzer runs on every substantive turn; both are overridable
 * via env so quality/cost can be tuned without a code change.
 */
const ANALYZER_MODEL = process.env.ANALYZER_MODEL ?? "gpt-4o-mini";
const ANALYZER_TEMPERATURE = 0.1;
const ANALYZER_MAX_TOKENS = 900;
/** Second attempt when the first is cut off. See the retry in `analyzeResponse`. */
const ANALYZER_RETRY_MAX_TOKENS = 1600;

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

/**
 * What the model actually returns, as opposed to what it was asked for.
 *
 * `parseAnalysisJson` casts the reply to `AnalysisResult`, which claims every
 * field is present. Treating it as partial at the one place that reads it is
 * the difference between a neutral default and a `NaN` in a chart.
 */
/**
 * The judgement fields the model is still responsible for, after the countable
 * ones moved to `text-metrics.ts`. Used only to report omissions.
 */
const MODEL_OWNED_FIELDS = [
  ["specificityMetrics", "hasStakeholders"],
  ["specificityMetrics", "vaguenessScore"],
  ["specificityMetrics", "concreteExamples"],
  ["confidenceIndicators", "assertivenessScore"],
  ["confidenceIndicators", "clarity"],
  ["responseQuality", "isRelevant"],
  ["responseQuality", "addressesExplicitly"],
  ["responseQuality", "depthLevel"],
  ["responseQuality", "thinkingVisible"],
] as const satisfies ReadonlyArray<
  readonly [keyof DeepPartialAnalysis, string]
>;

type DeepPartialAnalysis = {
  specificityMetrics?: Partial<SpecificityMetrics>;
  confidenceIndicators?: Partial<ConfidenceIndicators>;
  responseQuality?: Partial<ResponseQuality>;
};

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
  /**
   * Judgement fields the model omitted, which neutral defaults have since
   * filled in. Diagnostic only — read by the eval harness to measure schema
   * compliance, ignored by the product.
   */
  omittedFields?: string[];
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

export interface AnalyzeResponseOptions {
  /**
   * Optional role-context block (already formatted, e.g. via
   * `formatRetrievedJobContext`) inserted into the analysis prompt so the
   * analyzer can score against actual role requirements.
   */
  jobContext?: string | null;
  roundType?: InterviewRoundType;
  /** Records this call's token usage when supplied. */
  usage?: UsageCollector;
}

/**
 * Split into a round-type-determined scaffold and the per-turn content. The
 * scaffold is identical for every turn of a round type, so sending it first
 * (and pinning `prompt_cache_key` to the round type) lets it serve as a cached
 * prefix.
 */
function buildAnalysisPrompt(
  candidateResponse: string,
  question: string,
  jobContextBlock: string,
  roundType: InterviewRoundType,
): { staticScaffold: string; variable: string } {
  const rubric = ROUND_RUBRIC_LABELS[roundType];
  // STAR and the technical block are the two halves of the same split.
  const useStar = !isTechnicalRound(roundType);

  const technicalBlock = isTechnicalRound(roundType)
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

  // A code answer arrives fenced with its language. Naming it explicitly stops
  // the analyzer treating source as prose and scoring it for "specificity".
  const parsedCode = parseCodeAnswer(candidateResponse);
  const codeBlock = parsedCode
    ? `\n\nThe response contains ${parsedCode.language ?? "code"} source. Judge it as code: correctness against the stated problem, time and space complexity, edge-case handling, naming and structure. Do not penalise it for lacking narrative structure.${
        parsedCode.note ? "" : " No accompanying explanation was given."
      }`
    : "";

  const staticScaffold = `You are an expert interview analyst. Score the candidate response for a ${roundType} interview round.
Primary rubric: ${rubric}.
Use the STAR fields below only if they are filled in for this round; otherwise judge against the primary rubric above.

Return ONLY valid JSON with this structure:
{
  ${starBlock}
  ${technicalBlock}
  "specificityMetrics": {
    "hasStakeholders": boolean,
    "vaguenessScore": number (0-10, 10=vague),
    "concreteExamples": number
  },
  "confidenceIndicators": {
    "assertivenessScore": number (0-10),
    "clarity": number (0-10)
  },
  "responseQuality": {
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

  const variable = `${jobContextBlock}${codeBlock}

QUESTION ASKED:
${question}

CANDIDATE RESPONSE:
${candidateResponse}`;

  return { staticScaffold, variable };
}

/**
 * Perform STAR analysis on candidate response
 * This is the core analysis function
 */
/**
 * A complete STAR block, whatever the model returned.
 *
 * `decision-engine.ts` reads `starAnalysis.situation.present` unguarded, so a
 * partially-returned block is a TypeError in the middle of the turn pipeline —
 * and that throw is caught and downgraded to a warning, so the turn silently
 * loses its score rather than failing loudly.
 *
 * `present: false` and `quality: 0` are the honest defaults: the model did not
 * report that component, so treating it as absent is truthful, and it steers
 * the interviewer to probe for it.
 */
/** Longest a single note may be. Comfortably past a full sentence. */
const MAX_NOTE_CHARS = 200;
/** The model is asked for two of each; a third is a sign something went wrong. */
const MAX_NOTES = 3;

/**
 * Bound and flatten the analyzer's free-text notes.
 *
 * These three arrays are the only model output that travels back *into* a
 * prompt: `buildSteeringBlock` interpolates `strengths[0]` and `gaps[0]` into a
 * `role: "system"` message on the very next turn, and `loop-brief.ts` folds
 * them into the stable layer of the next round, where they persist in
 * `launch_meta` and are paid for on every turn thereafter.
 *
 * They are also derived from text the candidate wrote, which closes the loop: a
 * candidate can shape their answer so the analyzer emits a note containing
 * newlines and something that reads like an instruction, and that lands
 * unescaped inside a system message. `response_format: json_object` constrains
 * the shape of the reply, never the content of a string inside it.
 *
 * So: cap the count, cap the length, and collapse newlines — a note is one
 * line of coaching, and a line break is what makes injected text look like a
 * new directive rather than part of a sentence.
 */
export function sanitizeNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_CHARS))
    .filter(Boolean)
    .slice(0, MAX_NOTES);
}

function withStarDefaults(
  star: Partial<STARAnalysis> | undefined,
): STARAnalysis {
  return {
    situation: {
      present: star?.situation?.present ?? false,
      quality: star?.situation?.quality ?? 0,
      context: star?.situation?.context ?? "",
    },
    task: {
      present: star?.task?.present ?? false,
      quality: star?.task?.quality ?? 0,
      clarity: star?.task?.clarity ?? "",
    },
    action: {
      present: star?.action?.present ?? false,
      quality: star?.action?.quality ?? 0,
      specificity: star?.action?.specificity ?? 0,
      ownership: star?.action?.ownership ?? 0,
      summary: star?.action?.summary ?? "",
    },
    result: {
      present: star?.result?.present ?? false,
      quality: star?.result?.quality ?? 0,
      quantified: star?.result?.quantified ?? false,
      impact: star?.result?.impact ?? "",
    },
  };
}

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
  const { staticScaffold, variable } = buildAnalysisPrompt(
    candidateResponse,
    question,
    jobContextBlock,
    roundType,
  );

  const callAnalyzer = async (maxTokens: number) => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: ANALYZER_MODEL,
        // Round type keys the cache: the scaffold is identical across every
        // turn of a round, so this is the reusable prefix.
        prompt_cache_key: `analyzer:${roundType}`,
        messages: [
          {
            role: "system",
            content:
              "You are an expert interview analyst. You score candidate responses precisely and consistently, and you always reply with a single valid JSON object and nothing else.\n\n" +
              staticScaffold,
          },
          { role: "user", content: variable },
        ],
        temperature: ANALYZER_TEMPERATURE,
        // The full rubric fits comfortably; without a cap this ran unbounded
        // on every scored turn.
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(
        // Status only. On a content-filter rejection the error body echoes the
        // offending input, which here is the candidate's answer.
        `OpenAI API error: ${response.status}`,
      );
    }

    return response.json();
  };

  try {
    let result = await callAnalyzer(ANALYZER_MAX_TOKENS);
    options.usage?.record("analyzer", ANALYZER_MODEL, result?.usage);

    // A truncated reply is still syntactically *almost* JSON, so it used to
    // surface as a generic parse failure and the turn silently lost its score.
    //
    // One retry at a larger cap is worth it: the alternative is a gap in the
    // report with no explanation, and truncation should be rare enough that
    // the extra call barely registers. If it stops being rare, `llm_usage`
    // will show it — two analyzer rows for one turn.
    // `choices` can come back empty — OpenAI does this on some content-filter
    // and abort conditions. Indexing [0] blind threw a TypeError that the chat
    // route downgraded to a warning, so the turn silently went unscored with no
    // indication of why.
    const choice = result.choices?.[0];
    if (!choice) {
      throw new Error("Analyzer returned no choices.");
    }

    if (choice.finish_reason === "length") {
      console.warn(
        `Analyzer truncated at ${ANALYZER_MAX_TOKENS} tokens; retrying at ${ANALYZER_RETRY_MAX_TOKENS}.`,
      );
      result = await callAnalyzer(ANALYZER_RETRY_MAX_TOKENS);
      options.usage?.record("analyzer", ANALYZER_MODEL, result?.usage);

      if (result.choices?.[0]?.finish_reason === "length") {
        throw new Error(
          `Analyzer response was truncated even at ${ANALYZER_RETRY_MAX_TOKENS} tokens (finish_reason=length).`,
        );
      }
    }

    const rawAnalysis = result.choices?.[0]?.message?.content;

    // Parse the JSON response
    let analysisData;
    try {
      analysisData = parseAnalysisJson(rawAnalysis);
    } catch {
      /**
       * Deliberately not interpolating `rawAnalysis`.
       *
       * It is the analyzer's full verdict on the candidate's answer —
       * `starAnalysis.situation.context`, `.action.summary`, `.result.impact`,
       * `strengths`, `gaps` — which paraphrase and often quote what they wrote.
       * This error is caught in `/api/chat` and `console.warn`ed, so it landed
       * verbatim in platform logs, retained indefinitely and unredacted.
       *
       * The length and a short shape hint are what actually help diagnose a
       * parse failure; the content never did.
       */
      throw new Error(
        `Failed to parse analyzer response as JSON (${rawAnalysis.length} chars, starts with ${JSON.stringify(rawAnalysis.slice(0, 40))}).`,
      );
    }

    // Six fields are no longer asked of the model — they are counts, and the
    // model was neither cheap nor reliable at counting. Merged in here so the
    // shape callers consume is unchanged. See `text-metrics.ts`.
    const counted = analyzeText(candidateResponse);
    // Typed as a deep-partial: `AnalysisResult` says these fields are required,
    // but the model is not bound by our type declarations.
    const judged = analysisData as DeepPartialAnalysis;

    // Record what the model left out *before* the defaults below hide it.
    // Without this the eval harness's completeness metric would read 100%
    // forever, since every field is populated by the time it sees the result.
    const omittedFields = MODEL_OWNED_FIELDS.filter(
      ([parent, leaf]) => judged?.[parent]?.[leaf as never] === undefined,
    ).map(([parent, leaf]) => `${parent}.${leaf}`);

    return {
      // Neutral rather than raw. A model that omits `overallScore` used to
      // reach `buildSteeringBlock`, which interpolates it into the interviewer's
      // next prompt — producing the literal sentence "The candidate's last
      // answer scored NaN/100".
      overallScore:
        typeof analysisData.overallScore === "number" &&
        Number.isFinite(analysisData.overallScore)
          ? analysisData.overallScore
          : 50,
      roundType,
      // `starAnalysis` was the one judged object passed straight through while
      // its three siblings below were defaulted. That asymmetry was load-
      // bearing: `decision-engine.ts` reads `starAnalysis.situation.present`
      // with no optional chaining, so an omitted block threw a TypeError which
      // the chat route swallowed into a `console.warn` — the turn silently lost
      // its score, its analysis row, its micro-feedback and its steering
      // signal, and the user saw nothing at all.
      //
      // Note `averageStar` in the same file already used `star?.situation?.
      // quality`, so the absence was known about in one place and not the other.
      starAnalysis: withStarDefaults(analysisData.starAnalysis),
      technicalScores: analysisData.technicalScores,
      // The model-owned fields carry neutral defaults, because these three
      // objects are now *always* present — the counted fields below guarantee
      // it. Without defaults, a model that omitted `vaguenessScore` would
      // previously have produced `undefined` on a missing object (a crash at
      // the read site) and now produces `undefined` on a present one, which
      // reaches the sparklines as `(10 - undefined) * 10` = NaN. Silent NaN in
      // a chart is worse than either. 5 on a 0-10 scale matches the fallback
      // `decision-engine.ts` already uses.
      specificityMetrics: {
        hasStakeholders: judged?.specificityMetrics?.hasStakeholders ?? false,
        vaguenessScore: judged?.specificityMetrics?.vaguenessScore ?? 5,
        concreteExamples: judged?.specificityMetrics?.concreteExamples ?? 0,
        hasMetrics: counted.hasMetrics,
        metricCount: counted.metricCount,
        hasTimeframes: counted.hasTimeframes,
      },
      confidenceIndicators: {
        assertivenessScore:
          judged?.confidenceIndicators?.assertivenessScore ?? 5,
        clarity: judged?.confidenceIndicators?.clarity ?? 5,
        hesitationMarkers: counted.hesitationMarkers,
        qualificationCount: counted.qualificationCount,
        revisionsCount: counted.revisionsCount,
      },
      responseQuality: {
        isRelevant: judged?.responseQuality?.isRelevant ?? true,
        addressesExplicitly:
          judged?.responseQuality?.addressesExplicitly ?? true,
        depthLevel: judged?.responseQuality?.depthLevel ?? "moderate",
        thinkingVisible: judged?.responseQuality?.thinkingVisible ?? false,
        length: counted.wordCount,
      },
      // Always arrays. Consumers iterate these without guarding —
      // `interview-metrics.ts` does `analysis.gaps.forEach`, inside a client
      // render path, so a missing key surfaced as a raw TypeError message in
      // the user-visible coaching card.
      strengths: sanitizeNotes(analysisData.strengths),
      gaps: sanitizeNotes(analysisData.gaps),
      followupTopics: sanitizeNotes(analysisData.followupTopics),
      omittedFields,
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
export const INTERVIEW_STRATEGIES = [
  "CLARIFY_SITUATION",
  "PROBE_ACTION",
  "CHALLENGE_OWNERSHIP",
  "EXPLORE_RESULT",
  "ACKNOWLEDGE_STRENGTH",
  "DRILL_SPECIFICITY",
  "ASSESS_THINKING",
] as const;

export type InterviewStrategy = (typeof INTERVIEW_STRATEGIES)[number];

/**
 * Narrow a value read back from storage. Persisted strategies are plain `text`
 * in Postgres and may predate any given revision of this union, so validate
 * rather than cast.
 */
export function isInterviewStrategy(
  value: unknown,
): value is InterviewStrategy {
  return (
    typeof value === "string" &&
    (INTERVIEW_STRATEGIES as readonly string[]).includes(value)
  );
}
