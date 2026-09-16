/**
 * One automatic second attempt when a request never reaches the server.
 *
 * `fetch` rejects with a `TypeError` when the request fails below HTTP: a
 * dropped wifi frame, a sleeping laptop, a proxy closing a socket. The browser
 * calls that "Failed to fetch", and the app used to show exactly that, as a
 * wall: a failed speech token ended a voice interview before it began, and a
 * failed launch turned Start interview into a red line.
 *
 * A failing *status* is not retried. A 400 or a 500 is the server answering,
 * and sending the same request again would only ask it to refuse twice.
 */

export const NETWORK_ERROR_MESSAGE =
  "Couldn't reach the server. Check your connection and try again.";

/** True for a request that never got an answer, as opposed to a bad answer. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

/**
 * `fetch`, with one retry on a network-level failure.
 *
 * Note for callers who create something: the second attempt cannot tell a
 * request that never arrived from one whose *response* was lost, so a POST
 * that creates a row can create it twice in that narrow window. Use it where
 * an extra row is cheaper than a dead end — and never where it is not.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  retryDelayMs = 400,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!isNetworkError(error)) throw error;

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));

    try {
      return await fetch(input, init);
    } catch (retryError) {
      // Twice in a row is not a blip. Say what a candidate can act on rather
      // than passing the browser's own words through.
      if (isNetworkError(retryError)) throw new Error(NETWORK_ERROR_MESSAGE);
      throw retryError;
    }
  }
}
