/**
 * What a caught error is allowed to say on screen.
 *
 * Screens used to print `error.message`, so the browser's "Failed to fetch", a
 * JSON parser's complaint and an SDK's internal wording all reached the user.
 * Only a message this app wrote for the user is shown now; anything else
 * becomes the caller's fallback.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** A non-2xx from this app's own API, carrying the message the route authored. */
export class ApiError extends UserFacingError {
  constructor(
    message: string,
    readonly status: number,
    readonly ref?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The description under a "Couldn't load …" title, which already says what failed. */
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export const NETWORK_ERROR_MESSAGE =
  "Couldn't reach the server. Check your connection and try again.";

// Chrome, Safari, Firefox, Node and React Native, in that order.
const CONNECTION_FAILURE =
  /failed to fetch|load failed|networkerror|fetch failed|network request failed/i;

/**
 * True when the request never got an HTTP response.
 *
 * Matched on the message rather than `instanceof TypeError`: a TypeError is
 * also what a bug throws, and Supabase reports a dropped connection as an
 * `AuthRetryableFetchError` it returns instead of throwing.
 */
export function isConnectionFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "AuthRetryableFetchError") return true;
  return typeof message === "string" && CONNECTION_FAILURE.test(message);
}

export function toUserMessage(error: unknown, fallback: string): string {
  if (isConnectionFailure(error)) return NETWORK_ERROR_MESSAGE;
  if (error instanceof UserFacingError) return error.message;
  return fallback;
}
