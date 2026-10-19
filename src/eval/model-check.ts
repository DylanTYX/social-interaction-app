/**
 * The request each call site sends, in miniature.
 *
 * A model change fails in one of two ways: the new model answers worse (which
 * `npm run eval` and its siblings measure), or the new model refuses the
 * *request* — a parameter it does not take, a response format it does not
 * support — and every call returns a 400. The second kind is cheap to find and
 * expensive to find late: the persona harness alone is ~700 billed calls and
 * half an hour. So this builds one tiny request per call site, with the same
 * parameters the app sends (through the same `completionParams`), for
 * `run-model-check.ts` to fire before anything else does.
 *
 * Pure on purpose. What the app sends is decided here and tested without a
 * network; whether OpenAI accepts it is the runner's job.
 */

import { completionParams } from "@/lib/model-params";
import {
  ANALYZER_MODEL,
  COACH_MODEL,
  EMBEDDING_MODEL,
  INTERVIEWER_MODEL,
  JD_CLEAN_MODEL,
  JUDGE_MODEL,
  MODEL_RETIREMENTS,
  SUMMARY_MODEL,
} from "@/lib/models";

export interface SiteModels {
  interviewer: string;
  coach: string;
  analyzer: string;
  summary: string;
  jdClean: string;
  judge: string;
  embedding: string;
}

export interface CheckRequest {
  site: string;
  model: string;
  url: string;
  body: Record<string, unknown>;
  /** The reply is a server-sent stream rather than one JSON document. */
  stream: boolean;
  /** The reply content must parse as JSON (the site asks for JSON mode). */
  expectsJson: boolean;
}

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

/** What the app runs today: the registry, with any env override applied. */
export function currentModels(): SiteModels {
  return {
    interviewer: INTERVIEWER_MODEL,
    coach: COACH_MODEL,
    analyzer: ANALYZER_MODEL,
    summary: SUMMARY_MODEL,
    jdClean: JD_CLEAN_MODEL,
    judge: JUDGE_MODEL,
    embedding: EMBEDDING_MODEL,
  };
}

/**
 * What the migration plan moves to: each retiring default's `candidate` from
 * `MODEL_RETIREMENTS`. A site whose current model has no announced retirement
 * stays where it is.
 */
export function candidateModels(current = currentModels()): SiteModels {
  const next = (model: string) => MODEL_RETIREMENTS[model]?.candidate ?? model;
  return {
    interviewer: next(current.interviewer),
    coach: next(current.coach),
    analyzer: next(current.analyzer),
    summary: next(current.summary),
    jdClean: next(current.jdClean),
    judge: next(current.judge),
    embedding: current.embedding,
  };
}

const SAY_OK_JSON = [
  {
    role: "system",
    content: 'Reply with one JSON object and nothing else: {"ok": true}.',
  },
  { role: "user", content: "Say ok." },
];
const SAY_OK = [
  { role: "system", content: "Reply with one short word." },
  { role: "user", content: "Say ok." },
];

/**
 * One request per call site, mirroring the parameters in the route or module
 * named beside it. The token caps are small — this checks the contract, not
 * the quality — but the effort, temperature and response format are the app's.
 */
export function buildChecks(models: SiteModels): CheckRequest[] {
  return [
    {
      // api/chat/route.ts: streamed, usage requested, minimal effort.
      site: "interviewer",
      model: models.interviewer,
      url: CHAT_URL,
      stream: true,
      expectsJson: false,
      body: {
        model: models.interviewer,
        messages: SAY_OK,
        stream: true,
        stream_options: { include_usage: true },
        ...completionParams(models.interviewer, {
          temperature: 0.7,
          maxTokens: 24,
          reasoningEffort: "minimal",
        }),
        prompt_cache_key: "model-check:interviewer",
      },
    },
    {
      // coach-prompt.ts: low effort, JSON mode.
      site: "coach",
      model: models.coach,
      url: CHAT_URL,
      stream: false,
      expectsJson: true,
      body: {
        model: models.coach,
        ...completionParams(models.coach, {
          temperature: 0.5,
          maxTokens: 24,
          reasoningEffort: "low",
        }),
        response_format: { type: "json_object" },
        prompt_cache_key: "model-check:coach",
        messages: SAY_OK_JSON,
      },
    },
    {
      // response-analyzer.ts: temperature 0.1 where honoured, JSON mode.
      site: "assessor",
      model: models.analyzer,
      url: CHAT_URL,
      stream: false,
      expectsJson: true,
      body: {
        model: models.analyzer,
        prompt_cache_key: "model-check:analyzer",
        messages: SAY_OK_JSON,
        ...completionParams(models.analyzer, {
          temperature: 0.1,
          maxTokens: 24,
          reasoningEffort: "minimal",
        }),
        response_format: { type: "json_object" },
      },
    },
    {
      // summary.ts: plain text, temperature 0.2 where honoured.
      site: "summary",
      model: models.summary,
      url: CHAT_URL,
      stream: false,
      expectsJson: false,
      body: {
        model: models.summary,
        messages: SAY_OK,
        ...completionParams(models.summary, { temperature: 0.2, maxTokens: 24 }),
        prompt_cache_key: "model-check:summary",
      },
    },
    {
      // api/job-descriptions/clean/route.ts: temperature 0, JSON mode.
      site: "jd tidy-up",
      model: models.jdClean,
      url: CHAT_URL,
      stream: false,
      expectsJson: true,
      body: {
        model: models.jdClean,
        ...completionParams(models.jdClean, { temperature: 0, maxTokens: 24 }),
        response_format: { type: "json_object" },
        messages: SAY_OK_JSON,
      },
    },
    {
      // eval/run-persona-eval.ts and run-coach-eval.ts: the judge.
      site: "eval judge",
      model: models.judge,
      url: CHAT_URL,
      stream: false,
      expectsJson: true,
      body: {
        model: models.judge,
        ...completionParams(models.judge, { temperature: 0, maxTokens: 24 }),
        response_format: { type: "json_object" },
        messages: SAY_OK_JSON,
      },
    },
    {
      // embeddings.ts: never overridable, checked so a key problem is not
      // mistaken for a chat problem.
      site: "embeddings",
      model: models.embedding,
      url: EMBEDDINGS_URL,
      stream: false,
      expectsJson: false,
      body: { model: models.embedding, input: "ok" },
    },
  ];
}
