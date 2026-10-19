/**
 * Sampling parameters that depend on which model generation is being called.
 *
 * OpenAI has shipped three Chat Completions contracts, and every model in this
 * project is env-overridable, so the request body is built per generation
 * rather than hardcoded:
 *
 *   - **classic** (gpt-4o, gpt-4.1): `temperature` and `max_tokens`.
 *   - **gpt-5** (gpt-5, gpt-5-mini, gpt-5-nano and the o-series): reject
 *     `temperature` with a 400 ("unsupported parameter"), take
 *     `max_completion_tokens`, and are steered with `reasoning_effort` from
 *     `minimal` to `high`.
 *   - **current** (gpt-5.1 onwards, the gpt-5.6-* and gpt-6-* models):
 *     `minimal` is gone and `none` takes its place, and sampling parameters are
 *     accepted at `none` only — OpenAI's GPT-6 migration guide: "when reasoning
 *     effort is not `none`, remove `temperature`, `top_p` and `top_logprobs`".
 *     gpt-6-astra and gpt-6.1-* reject `none` altogether; the guide says to
 *     use `low` there.
 *
 * Call sites state their intent once, in the oldest vocabulary (`temperature`,
 * `maxTokens`, `reasoningEffort`), and this is the one place that knows how to
 * say it to each generation. Stating both halves at the call site means an env
 * override never silently changes the *requested* behaviour — only which part
 * of it the model is able to honour.
 *
 * The `current` contract is taken from the migration guide; no call in this
 * project has run against a model of that generation yet. The harness runs in
 * docs/TOKEN-COST.md §"Retirements and the migration" are where it is confirmed.
 */

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export type ModelGeneration = "classic" | "gpt-5" | "current";

/**
 * Reasoning tokens are billed and counted inside `max_completion_tokens`, so a
 * cap sized for the visible answer would let the hidden reasoning starve it —
 * the response comes back `finish_reason: "length"` with truncated (or empty)
 * content. With reasoning off (`minimal`, or `none` on the current generation)
 * there is nothing to make room for; above it, this headroom is added on top
 * of the caller's cap so the visible output keeps the budget the caller sized.
 */
const REASONING_HEADROOM_TOKENS = 1024;

export function modelGeneration(model: string): ModelGeneration {
  if (/^(gpt-5\.\d|gpt-6)/.test(model)) return "current";
  if (/^(gpt-5|o\d)/.test(model)) return "gpt-5";
  return "classic";
}

export function isReasoningModel(model: string): boolean {
  return modelGeneration(model) !== "classic";
}

/**
 * The major generation a model belongs to — "gpt-4" for gpt-4o-mini, "gpt-5"
 * for gpt-5-mini and gpt-5.6-luna, "gpt-6" for gpt-6-luna.
 *
 * This is the unit of the judge-independence rule in the evaluation harnesses:
 * a judge must not share a generation with the model it judges, or an
 * improvement reads as a model grading its own homework. Point releases count
 * as the same generation because they share a lineage and, plausibly, its
 * blind spots.
 */
export function modelFamily(model: string): string {
  return /^(gpt-\d+|o\d)/.exec(model)?.[1] ?? model;
}

/** gpt-6-astra and gpt-6.1-* return 400 on `reasoning_effort: "none"`. */
function acceptsNoReasoning(model: string): boolean {
  return !/^(gpt-6-astra|gpt-6\.\d)/.test(model);
}

export function completionParams(
  model: string,
  options: {
    /**
     * Honoured by classic models, and by the current generation when its
     * reasoning is off; the gpt-5 generation rejects it outright.
     */
    temperature: number;
    /** Visible-output budget. Reasoning models get headroom on top (above). */
    maxTokens: number;
    /**
     * Used only by reasoning models. Defaults to `minimal`, which behaves the
     * most like the non-reasoning call it replaces: near-zero added latency
     * and no hidden token spend. On the current generation it is sent as
     * `none`.
     */
    reasoningEffort?: ReasoningEffort;
  },
): Record<string, unknown> {
  const effort = options.reasoningEffort ?? "minimal";

  switch (modelGeneration(model)) {
    case "classic":
      return {
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      };
    case "gpt-5":
      return {
        max_completion_tokens:
          options.maxTokens +
          (effort === "minimal" ? 0 : REASONING_HEADROOM_TOKENS),
        reasoning_effort: effort,
      };
    case "current":
      if (effort === "minimal") {
        if (acceptsNoReasoning(model)) {
          return {
            temperature: options.temperature,
            max_completion_tokens: options.maxTokens,
            reasoning_effort: "none",
          };
        }
        return {
          max_completion_tokens: options.maxTokens + REASONING_HEADROOM_TOKENS,
          reasoning_effort: "low",
        };
      }
      return {
        max_completion_tokens: options.maxTokens + REASONING_HEADROOM_TOKENS,
        reasoning_effort: effort,
      };
  }
}
