import { ClientVisibleError } from "@/lib/api/errors";

/**
 * OpenAI failures that the person running the deployment can act on.
 *
 * Every one of these used to reach the candidate as "Something went wrong.
 * Please try again." — which is the right answer for a bug and the wrong one
 * for a deployment with no API key. On Vercel that is the common case: a key
 * added to Production but not Preview, or added without a redeploy, so the app
 * signs in, creates the session, and then fails on the interviewer's very
 * first word with nothing to say why. Retrying cannot fix any of these.
 *
 * The messages are authored here and name no internals beyond the variable a
 * deployer has to set. The raw OpenAI body — which can carry organisation and
 * project identifiers — goes to the server log only, never to the client.
 */

const UNAVAILABLE = "The interviewer is unavailable";

export function missingOpenAIKey(): ClientVisibleError {
  return new ClientVisibleError(
    `${UNAVAILABLE}: this deployment has no OPENAI_API_KEY. Add it to the environment the deployment runs in (Production and Preview are separate on Vercel), then redeploy.`,
    503,
  );
}

/**
 * Map a non-OK OpenAI response to an error.
 *
 * Configuration failures become `ClientVisibleError`s with a message that says
 * what to fix. Anything else stays a plain `Error`, so `handleRouteError` still
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
      `${UNAVAILABLE}: OpenAI rejected this deployment's API key. Check OPENAI_API_KEY and redeploy.`,
      502,
    );
  }
  if (status === 429) {
    return new ClientVisibleError(
      `${UNAVAILABLE}: this deployment's OpenAI account is rate-limited or out of credit. Try again shortly, or check the account's billing.`,
      503,
    );
  }
  if (status === 403 || status === 404) {
    return new ClientVisibleError(
      `${UNAVAILABLE}: this deployment's OpenAI key cannot use the ${context.model ?? "configured"} model.`,
      502,
    );
  }
  return new Error(`OpenAI ${context.call} request failed: ${status} ${body}`);
}
