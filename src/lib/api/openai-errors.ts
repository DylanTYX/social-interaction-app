import { ClientVisibleError } from "@/lib/api/errors";

/**
 * OpenAI failures that the person running the deployment can act on.
 *
 * Every one of these used to reach the candidate as "Something went wrong.
 * Please try again." — the right answer for a bug and the wrong one for a
 * deployment with no API key, which retrying cannot fix. On Vercel that is the
 * common case: a key added to Production but not Preview, or added without a
 * redeploy.
 *
 * The candidate is told the interviewer is unavailable, and nothing about why:
 * the provider, the variable, the model and the state of the account are the
 * deployer's business. Those go in `operatorHint`, which is logged under the
 * reference the candidate sees and shown on screen only outside production.
 * The raw OpenAI body — which can carry organisation and project identifiers —
 * goes to the server log only.
 */

const UNAVAILABLE = "The interviewer is unavailable right now.";
const BUSY = "The interviewer is busy right now. Try again shortly.";

export function missingOpenAIKey(): ClientVisibleError {
  return new ClientVisibleError(
    UNAVAILABLE,
    503,
    "This deployment has no OPENAI_API_KEY. Add it to the environment the deployment runs in (Production and Preview are separate on Vercel), then redeploy.",
  );
}

/**
 * Map a non-OK OpenAI response to an error.
 *
 * Configuration failures become `ClientVisibleError`s whose hint says what to
 * fix. Anything else stays a plain `Error`, so `handleRouteError` still
 * logs it and returns the generic 500 — a transient 500 from OpenAI is not
 * something to explain to a candidate.
 */
export function openAIResponseError(
  status: number,
  body: string,
  context: { model?: string; call: string },
): Error {
  console.error(`[openai:${context.call}]`, status, context.model ?? "", body.slice(0, 2_000));

  if (status === 401) {
    return new ClientVisibleError(
      UNAVAILABLE,
      502,
      "OpenAI rejected this deployment's API key. Check OPENAI_API_KEY and redeploy.",
    );
  }
  if (status === 429) {
    return new ClientVisibleError(
      BUSY,
      503,
      "This deployment's OpenAI account is rate-limited or out of credit. Check the account's billing.",
    );
  }
  if (status === 403 || status === 404) {
    return new ClientVisibleError(
      UNAVAILABLE,
      502,
      `This deployment's OpenAI key cannot use the ${context.model ?? "configured"} model.`,
    );
  }
  return new Error(`OpenAI ${context.call} request failed: ${status} ${body}`);
}
