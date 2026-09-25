import { describe, expect, it } from "vitest";

import {
  authErrorMessage,
  INVALID_CREDENTIALS_MESSAGE,
  passwordResetFeedback,
  RESET_SENT_MESSAGE,
} from "@/lib/auth-error-message";
import { NETWORK_ERROR_MESSAGE } from "@/lib/user-facing-error";

/**
 * The forms used to print Supabase's own text. These pin that a stranger
 * cannot learn from the screen whether an email has an account, and that the
 * SDK's wording never gets through.
 */

const supabaseError = (message: string, status: number, code?: string) =>
  Object.assign(new Error(message), { name: "AuthApiError", status, code });

const dropped = Object.assign(new Error("Failed to fetch"), {
  name: "AuthRetryableFetchError",
  status: 0,
});

describe("a refused sign-in", () => {
  const refusals = [
    supabaseError("Invalid login credentials", 400, "invalid_credentials"),
    supabaseError("User not found", 400, "user_not_found"),
    supabaseError("User is banned", 400, "user_banned"),
    supabaseError("Some future wording", 422),
  ];

  it("reads the same whatever the reason", () => {
    const messages = new Set(refusals.map((e) => authErrorMessage("sign-in", e)));
    expect([...messages]).toEqual([INVALID_CREDENTIALS_MESSAGE]);
  });

  it('says "credentials", and never which half was wrong', () => {
    expect(INVALID_CREDENTIALS_MESSAGE).toMatch(/credentials/);
    expect(INVALID_CREDENTIALS_MESSAGE).not.toMatch(/password|email|user|account/i);
  });

  it("never repeats the SDK's text", () => {
    for (const error of [...refusals, dropped, new Error("Missing NEXT_PUBLIC_SUPABASE_URL")]) {
      expect(authErrorMessage("sign-in", error)).not.toContain(error.message);
    }
  });

  it("says the connection dropped instead of 'Failed to fetch'", () => {
    expect(authErrorMessage("sign-in", dropped)).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("says to slow down on a rate limit", () => {
    expect(
      authErrorMessage("sign-in", supabaseError("Rate limit", 429, "over_request_rate_limit")),
    ).toMatch(/too many attempts/i);
  });

  it("keeps an outage apart from a refusal", () => {
    expect(authErrorMessage("sign-in", supabaseError("upstream", 503))).not.toBe(
      INVALID_CREDENTIALS_MESSAGE,
    );
  });
});

describe("a refused sign-up", () => {
  it("does not confirm that the email already has an account", () => {
    const taken = authErrorMessage(
      "sign-up",
      supabaseError("User already registered", 422, "user_already_exists"),
    );
    const other = authErrorMessage("sign-up", supabaseError("Signups not allowed", 422, "signup_disabled"));
    expect(taken).toBe(other);
    expect(taken).not.toMatch(/already registered|exists|taken/i);
  });

  it("still explains the person's own input", () => {
    expect(
      authErrorMessage("sign-up", supabaseError("Password is too weak", 422, "weak_password")),
    ).toMatch(/stronger password/i);
    expect(
      authErrorMessage("sign-up", supabaseError("bad email", 400, "email_address_invalid")),
    ).toMatch(/valid email/i);
  });
});

describe("forgot password", () => {
  it("answers the same for an address with an account and one without", () => {
    // Supabase rate-limits only addresses that exist, so the limit itself
    // would give the answer away.
    const limited = supabaseError("only request this after 60 seconds", 429, "over_email_send_rate_limit");
    expect(passwordResetFeedback(null)).toEqual({ kind: "info", message: RESET_SENT_MESSAGE });
    expect(passwordResetFeedback(limited)).toEqual({ kind: "info", message: RESET_SENT_MESSAGE });
  });

  it("reports an outage and a dropped connection as errors", () => {
    expect(passwordResetFeedback(supabaseError("upstream", 500)).kind).toBe("error");
    expect(passwordResetFeedback(dropped)).toEqual({
      kind: "error",
      message: NETWORK_ERROR_MESSAGE,
    });
  });
});
