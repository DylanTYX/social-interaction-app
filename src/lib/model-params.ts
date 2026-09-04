/**
 * Sampling parameters that depend on which model family is being called.
 *
 * The GPT-5 family (and the o-series before it) are reasoning models with a
 * different Chat Completions contract: they reject `temperature` outright
 * (400, "unsupported parameter"), take `max_completion_tokens` instead of
 * `max_tokens`, and are steered with `reasoning_effort` in temperature's
 * place. Every model here is env-overridable, so any call site can be pointed
 * at either family at runtime — which means the request body has to be built
 * per family, not hardcoded. This is the one place that knows the difference;
 * call sites state their intent (temperature, cap, effort) and spread the
 * result.
 *
 * Why intent is stated twice: `temperature` applies only when the model turns
 * out to be a GPT-4-family one, `reasoningEffort` only when it is a reasoning
 * model. Keeping both at the call site means an env override never silently
 * changes the *requested* behaviour — only which half of it the model is able
 * to honour.
 */

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

/**
 * Reasoning tokens are billed and counted inside `max_completion_tokens`, so a
 * cap sized for the visible answer would let the hidden reasoning starve it —
 * the response comes back `finish_reason: "length"` with truncated (or empty)
 * content. At `minimal` effort reasoning is a token or two and needs no room;
 * above it, this headroom is added on top of the caller's cap so the visible
 * output keeps the budget the caller sized.
 */
const REASONING_HEADROOM_TOKENS = 1024;

export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/.test(model);
}

export function completionParams(
  model: string,
  options: {
    /** Used only by non-reasoning models; GPT-5 rejects it. */
    temperature: number;
    /** Visible-output budget. Reasoning models get headroom on top (above). */
    maxTokens: number;
    /**
     * Used only by reasoning models. Defaults to `minimal`, which behaves the
     * most like the non-reasoning call it replaces: near-zero added latency
     * and no hidden token spend.
     */
    reasoningEffort?: ReasoningEffort;
  },
): Record<string, unknown> {
  if (isReasoningModel(model)) {
    const effort = options.reasoningEffort ?? "minimal";
    return {
      max_completion_tokens:
        options.maxTokens +
        (effort === "minimal" ? 0 : REASONING_HEADROOM_TOKENS),
      reasoning_effort: effort,
    };
  }
  return {
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  };
}
