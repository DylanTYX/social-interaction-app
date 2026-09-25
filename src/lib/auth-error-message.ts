import {
  isConnectionFailure,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/user-facing-error";

/**
 * What the sign-in, sign-up and reset forms say when Supabase refuses.
 *
 * The SDK's own text never reaches the screen. It says which half of a sign-in
 * was wrong on some versions, says "User already registered" to anyone who
 * asks, and on a dropped connection says "Failed to fetch". Each of the first
 * two tells a stranger whether an email has an account here.
 *
 * So a refused sign-in always reads the same, whatever the reason, and speaks
 * of "credentials" and never of the email or the password. The only messages
 * that vary are about the input the person typed themselves (a weak password,
 * a malformed email), about rate limits, and about the connection.
 */

export type AuthAction = "sign-in" | "sign-up" | "account";

export const INVALID_CREDENTIALS_MESSAGE =
  "Those credentials didn't match. Check them and try again.";
export const RESET_SENT_MESSAGE =
  "If an account exists for that email, a reset link is on its way.";

const TOO_MANY_ATTEMPTS = "Too many attempts. Wait a minute, then try again.";
const UNAVAILABLE: Record<AuthAction, string> = {
  "sign-in": "Couldn't sign you in just now. Try again shortly.",
  "sign-up": "Couldn't create your account just now. Try again shortly.",
  account: "Couldn't save that just now. Try again shortly.",
};

type AuthErrorLike = { status?: unknown; code?: unknown; name?: unknown };

function read(error: unknown): { status: number | null; code: string; name: string } {
  const e = (typeof error === "object" && error !== null ? error : {}) as AuthErrorLike;
  return {
    status: typeof e.status === "number" ? e.status : null,
    code: typeof e.code === "string" ? e.code : "",
    name: typeof e.name === "string" ? e.name : "",
  };
}

function isRateLimited(status: number | null, code: string): boolean {
  return status === 429 || /^over_.*_rate_limit$/.test(code);
}

export function authErrorMessage(action: AuthAction, error: unknown): string {
  if (isConnectionFailure(error)) return NETWORK_ERROR_MESSAGE;

  const { status, code, name } = read(error);
  if (isRateLimited(status, code)) return TOO_MANY_ATTEMPTS;
  if (status === null || status >= 500) return UNAVAILABLE[action];

  if (action === "sign-in") {
    // Supabase checks the password before it checks confirmation, so this is
    // only ever said to someone who already holds the right credentials.
    if (code === "email_not_confirmed") {
      return "Confirm your email address before signing in. The link is in your inbox.";
    }
    return INVALID_CREDENTIALS_MESSAGE;
  }

  if (code === "weak_password" || name === "AuthWeakPasswordError") {
    return "Choose a stronger password: at least 8 characters, and not one that is easy to guess.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return "Enter a valid email address.";
  }
  if (action === "sign-up") {
    // Deliberately the same for "already registered" as for every other
    // refusal, so the form does not confirm that an email has an account.
    return "Couldn't create an account with those details. If you already have one, sign in instead.";
  }
  return UNAVAILABLE.account;
}

/**
 * The outcome of "Forgot password?" on the sign-in form.
 *
 * Supabase rate-limits reset emails only for addresses that exist, so even
 * "too many attempts" would answer the question the neutral message refuses
 * to. Anything short of an outage or a malformed address reads as sent.
 */
export function passwordResetFeedback(
  error: unknown | null,
): { kind: "info" | "error"; message: string } {
  if (!error) return { kind: "info", message: RESET_SENT_MESSAGE };
  if (isConnectionFailure(error)) {
    return { kind: "error", message: NETWORK_ERROR_MESSAGE };
  }
  const { status, code } = read(error);
  if (code === "email_address_invalid" || code === "validation_failed") {
    return { kind: "error", message: "Enter a valid email address." };
  }
  if (!isRateLimited(status, code) && (status === null || status >= 500)) {
    return {
      kind: "error",
      message: "Couldn't send the reset email just now. Try again shortly.",
    };
  }
  return { kind: "info", message: RESET_SENT_MESSAGE };
}
