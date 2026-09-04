import { jsonrepair } from "jsonrepair";

import { detectBehavioralSignals } from "@/lib/text-metrics";

import type { AnswerMode, SuggestedAnswerResult } from "@/lib/coach-contract";
import { COACH_RUBRICS } from "@/lib/coach-rubric";
import {
  ROUND_RUBRIC_LABELS,
  ROUND_TYPE_LABELS,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
import type { UsageCollector, OpenAIUsage } from "@/lib/api/token-usage";
import { completionParams } from "@/lib/model-params";

/**
 * The coach call, as a pure module.
 *
 * Extracted from `app/api/coach/suggested-answer/route.ts` for the reason
 * `run-persona-eval.ts` can import `generatePersonaPrompt` and no harness could
 * ever import this: the prompt was welded into an HTTP handler that pulls in
 * `next/server` and `@/lib/supabase/server` (and through it `next/headers`), so
 * a `tsx` script importing the route would not merely be ugly — it would fail
 * outside Next's request scope. The one LLM call in the app with no evaluation
 * was also the one that could not be called from an evaluator.
 *
 * The eslint boundary runs the other way and is unaffected: `src/app` and
 * `src/components` may not import `@/eval`, but `src/eval` importing `src/lib`
 * is what all three existing harnesses already do. This module must therefore
 * never import `@/eval` or `@/lib/pricing`, since the route imports it.
 */

/**
 * `gpt-5-mini` at `low` reasoning effort. The coach's output — the suggested
 * answer and the rewrite — is read verbatim by the user, so answer quality is
 * the product here, and nobody is waiting on a live microphone: drills
 * feedback renders when it renders. `low` (not `minimal`) buys a planning pass
 * over the rubric for ~a second of latency; the JSON contract and the
 * `finish_reason: "length"` guard below already police the failure modes.
 * Compare against gpt-4o-mini with `COACH_MODEL=gpt-4o-mini npm run
 * eval:coach -- --live` — the judge is model-independent.
 */
export const COACH_MODEL = process.env.COACH_MODEL ?? "gpt-5-mini";

/**
 * Higher than the analyzer's 0.1, deliberately.
 *
 * Scoring has to be reproducible — a candidate who re-runs the same answer and
 * gets 62 then 78 will not trust anything the app says. Coaching does not have
 * that constraint: two different well-aimed rewrites of the same answer are
 * both correct, and pinning it to near-zero would produce prose that reads like
 * a form letter. The cost is that coaching cannot be regression-tested by
 * equality, which is why `run-coach-eval.ts` measures it by score uplift.
 */
export const COACH_TEMPERATURE = 0.5;

/**
 * Output cap.
 *
 * Was 700, which was too tight for what the prompt asks for: a 4-8 sentence
 * suggested answer, plus a full rewrite of the candidate's answer, plus four tips —
 * roughly 550-710 tokens of JSON at the top end. Sitting on the boundary meant
 * occasional truncation, and because there was no `finish_reason` check it
 * surfaced as an unparseable-JSON error with no indication of the real cause.
 */
export const COACH_MAX_TOKENS = 1000;

/** The prompt asks for 2-4; anything past 4 is dropped rather than shown. */
export const MAX_TIPS = 4;
const MIN_TIPS = 2;
/** "max ~12 words each" in the prompt; a little slack before it counts as a miss. */
const MAX_TIP_WORDS = 14;

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * What an unknown or absent round type is coached as.
 *
 * Named rather than inline because it is asserted by two tests: the route's
 * "falls back to an invalid round type rather than trusting it", which checks
 * the built prompt still mentions STAR, and the prompt module's own fallback
 * test. Behavioural is the right default — it is the only rubric that applies
 * to a question whose type we genuinely do not know.
 */
export const COACH_FALLBACK_ROUND_TYPE: InterviewRoundType = "behavioral";

/**
 * The per-round rubric block.
 *
 * The criteria are interpolated from `ROUND_RUBRIC_LABELS`, never re-typed, so
 * the coach optimises for the same string the analyzer scores against. The
 * "what good looks like" prose is the only thing `coach-rubric.ts` adds.
 */
function rubricGuidance(roundType: InterviewRoundType): string {
  const rubric = COACH_RUBRICS[roundType];

  return [
    `This is a ${ROUND_TYPE_LABELS[roundType]} round. It is scored on: ${ROUND_RUBRIC_LABELS[roundType]}.`,
    `A strong answer is shaped: ${rubric.shape}`,
    "A strong answer shows:",
    ...rubric.signals.map((signal) => `- ${signal}`),
    "The characteristic failures of this round are:",
    ...rubric.failureModes.map((mode) => `- ${mode}`),
    "Your tips must name the failures actually present in this candidate's answer. Do not give advice that would apply to any answer.",
    `The suggested answer must demonstrate: ${rubric.exemplar}`,
  ].join("\n");
}

/**
 * What the coach needs to know about the *form* of the answer.
 *
 * Both non-default modes exist to stop the coach spending its four tips on the
 * medium instead of the answer. Against a transcript that means not billing the
 * candidate for punctuation Azure never inserted; against code it means the
 * rewrite has to stay code, because "tighten structure, add specificity" read
 * against a fenced function otherwise produces a paragraph *about* the
 * function.
 */
function modeGuidance(mode: AnswerMode): string[] {
  switch (mode) {
    case "speech":
      return [
        "The candidate's answer is a live speech-to-text transcript of them speaking. Missing punctuation, missing capitalisation, run-on sentences and the occasional misrecognised word are artefacts of transcription, not of their thinking.",
        "Fix those silently in the rewrite and never spend a tip on them. Judge the answer on its content and structure, exactly as you would a written one.",
        "Verbal fillers — 'um', 'you know', 'sort of' — are worth at most one tip, and only when they are frequent enough to be the dominant problem. The candidate is separately shown a count.",
      ];
    case "code":
      return [
        "The candidate's answer is code, in a fenced block, optionally preceded by a short note.",
        "The rewrite must stay code in the same language and the same fenced form — it is their solution improved, not a description of it. Keep their approach and their identifiers; fix correctness, edge cases, naming and complexity.",
        "Tips are about the solution: correctness, complexity, edge cases, readability. Say the complexity out loud when it is the thing that is wrong.",
      ];
    case "text":
      return [];
  }
}

export function buildCoachSystemPrompt(
  roundType: InterviewRoundType | undefined,
  answerMode: AnswerMode = "text",
): string {
  const type = roundType ?? COACH_FALLBACK_ROUND_TYPE;

  return [
    "You are an expert interview coach. Given an interview question and the candidate's actual answer, produce concrete, instructive feedback.",
    rubricGuidance(type),
    ...modeGuidance(answerMode),
    "Return ONLY a JSON object with this exact shape:",
    '{"suggestedAnswer": string, "rewrite": string, "tips": string[]}',
    "- suggestedAnswer: an exemplary answer to the question (concise, realistic, first-person, 4-8 sentences). Invent plausible specifics where needed.",
    "- rewrite: the candidate's OWN answer improved — keep their facts and example, but tighten structure, add specificity, and fix weak spots.",
    // The clause this replaces read "Do not fabricate major new achievements",
    // which cannot be tested because "major" is undefined. Stated this way it
    // is a contract the harness can check: extract the quantities from both
    // texts and compare the sets.
    "- Every specific in `rewrite` — every number, name, date and outcome — must already appear in the candidate's answer. If their answer contains no number, the rewrite contains no number: say what they should have measured instead of inventing a measurement.",
    `- tips: ${MIN_TIPS}-${MAX_TIPS} short, specific, actionable improvements (max ~12 words each).`,
    "No markdown, no commentary outside the JSON.",
  ].join("\n");
}

export function buildCoachUserPrompt(question: string, answer: string): string {
  /**
   * Evidence-gap signals, so a tip can cite the candidate's exact word —
   * "you said 'helped with': name what you owned" — rather than paraphrasing
   * words they never used. Deterministic detection, same lexicon the
   * interviewer's probes and the analyzer's marking read, so all three
   * surfaces agree on what was flagged. Silent when nothing fires.
   */
  const detected = detectBehavioralSignals(answer).signals;
  const signalBlock =
    detected.length === 0
      ? ""
      : `\n\nLANGUAGE SIGNALS (deterministic, from the answer text):\n${detected
          .map(
            (signal) =>
              `- ${signal.type}: ${signal.markers.map((m) => `"${m}"`).join(", ")}`,
          )
          .join(
            "\n",
          )}\nWhere relevant, make one tip quote the exact word and ask for the evidence it hides — do not penalise the word itself.`;

  return `QUESTION:\n${question}\n\nCANDIDATE ANSWER:\n${answer}${signalBlock}`;
}

export interface CoachParseResult {
  result: SuggestedAnswerResult;
  /**
   * Fields the model omitted, recorded *before* the `""` defaults hide them.
   *
   * The direct analogue of `AnalysisResult.omittedFields`, and it exists for
   * the same reason: without it the finished object is complete by
   * construction and a completeness metric measures nothing. Diagnostic only —
   * the product ignores it, the harness reads it.
   */
  omittedFields: string[];
  /** True when `JSON.parse` threw and `jsonrepair` recovered it. */
  repaired: boolean;
  /** Contract breaches that are not omissions: tip count, tip length. */
  contractWarnings: string[];
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1).trim();
  }

  return trimmed;
}

export function parseCoachResult(content: string): CoachParseResult {
  const payload = extractJsonPayload(content);

  let parsed: { suggestedAnswer?: unknown; rewrite?: unknown; tips?: unknown };
  let repaired = false;
  try {
    parsed = JSON.parse(payload);
  } catch {
    parsed = JSON.parse(jsonrepair(payload));
    repaired = true;
  }

  const omittedFields: string[] = [];
  const contractWarnings: string[] = [];

  const suggestedAnswer =
    typeof parsed.suggestedAnswer === "string" && parsed.suggestedAnswer.trim()
      ? parsed.suggestedAnswer
      : (omittedFields.push("suggestedAnswer"), "");

  const rewrite =
    typeof parsed.rewrite === "string" && parsed.rewrite.trim()
      ? parsed.rewrite
      : (omittedFields.push("rewrite"), "");

  const rawTips = Array.isArray(parsed.tips)
    ? parsed.tips.filter((tip): tip is string => typeof tip === "string")
    : [];

  if (!Array.isArray(parsed.tips) || rawTips.length === 0) {
    omittedFields.push("tips");
  } else if (rawTips.length < MIN_TIPS || rawTips.length > MAX_TIPS) {
    contractWarnings.push(
      `tips count ${rawTips.length}, expected ${MIN_TIPS}-${MAX_TIPS}`,
    );
  }

  const overlong = rawTips.filter(
    (tip) => tip.trim().split(/\s+/).length > MAX_TIP_WORDS,
  ).length;
  if (overlong > 0) {
    contractWarnings.push(`${overlong} tip(s) over ${MAX_TIP_WORDS} words`);
  }

  return {
    result: { suggestedAnswer, rewrite, tips: rawTips.slice(0, MAX_TIPS) },
    omittedFields,
    repaired,
    contractWarnings,
  };
}

export interface CoachCallResult extends CoachParseResult {
  /**
   * Returned rather than thrown on truncation.
   *
   * The route maps `"length"` to its 502 with a message that names truncation;
   * the harness needs to *count* truncations, which it cannot do if they have
   * been collapsed into an error string. That asymmetry is the reason this
   * function exists as something other than the route's body.
   */
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
}

export class CoachRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: string,
  ) {
    super(message);
    this.name = "CoachRequestError";
  }
}

export async function requestCoaching(input: {
  question: string;
  answer: string;
  roundType?: InterviewRoundType;
  answerMode?: AnswerMode;
  apiKey: string;
  usage?: UsageCollector;
}): Promise<CoachCallResult> {
  const answerMode = input.answerMode ?? "text";
  const systemPrompt = buildCoachSystemPrompt(input.roundType, answerMode);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: COACH_MODEL,
      ...completionParams(COACH_MODEL, {
        temperature: COACH_TEMPERATURE,
        maxTokens: COACH_MAX_TOKENS,
        reasoningEffort: "low",
      }),
      response_format: { type: "json_object" },
      // The system prompt grew from ~150 to ~300 tokens with the real rubric,
      // and is byte-identical for every call of a given round type *and* answer
      // mode — which is precisely the cached-prefix case. The mode is in the
      // key because it is in the prompt: without it the three variants would
      // share a key and each would keep invalidating the others' cached prefix.
      // `run-cost-report.ts` already reads `cachedTokens`, so whether this pays
      // for itself is measurable rather than argued.
      prompt_cache_key: `coach:${input.roundType ?? COACH_FALLBACK_ROUND_TYPE}:${answerMode}`,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: buildCoachUserPrompt(input.question, input.answer),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new CoachRequestError(
      "Failed to generate coaching answer.",
      response.status,
      detail.slice(0, 500),
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: OpenAIUsage;
  };

  input.usage?.record("coach", COACH_MODEL, data.usage);

  const finishReason = data.choices?.[0]?.finish_reason ?? null;
  const content = data.choices?.[0]?.message?.content ?? "";

  // A truncated response is *almost* valid JSON, so parsing it first would fail
  // as a generic syntax error and name the wrong cause. Report the shape and
  // let the caller decide.
  if (finishReason === "length") {
    return {
      result: { suggestedAnswer: "", rewrite: "", tips: [] },
      omittedFields: ["suggestedAnswer", "rewrite", "tips"],
      repaired: false,
      contractWarnings: ["truncated"],
      finishReason,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  return {
    ...parseCoachResult(content),
    finishReason,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}
