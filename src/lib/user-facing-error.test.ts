import { describe, expect, it } from "vitest";

import {
  ApiError,
  isConnectionFailure,
  NETWORK_ERROR_MESSAGE,
  toUserMessage,
  UserFacingError,
} from "@/lib/user-facing-error";

/**
 * Screens printed `error.message`, so "Failed to fetch" and a JSON parser's
 * complaint reached the user. These pin what may be shown and what may not.
 */

describe("toUserMessage", () => {
  it.each([
    ["Chrome", new TypeError("Failed to fetch")],
    ["Safari", new TypeError("Load failed")],
    ["Firefox", new TypeError("NetworkError when attempting to fetch resource.")],
    ["Node", new TypeError("fetch failed")],
    [
      "Supabase, which returns it instead of throwing",
      Object.assign(new Error("Failed to fetch"), {
        name: "AuthRetryableFetchError",
        status: 0,
      }),
    ],
  ])("turns a dropped connection from %s into plain words", (_, error) => {
    expect(toUserMessage(error, "fallback")).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("shows a message the app wrote for the user", () => {
    expect(toUserMessage(new UserFacingError("Title cannot be empty."), "x")).toBe(
      "Title cannot be empty.",
    );
    expect(toUserMessage(new ApiError("Resume is too short.", 400), "x")).toBe(
      "Resume is too short.",
    );
  });

  it.each([
    new SyntaxError("Unexpected token '<', \"<html>\" is not valid JSON"),
    new TypeError("Cannot read properties of undefined (reading 'id')"),
    new Error('relation "interview_sessions" does not exist'),
    "a string",
    null,
  ])("never shows anything else: %s", (error) => {
    expect(toUserMessage(error, "Couldn't save that.")).toBe("Couldn't save that.");
  });

  it("does not mistake a bug's TypeError for a dropped connection", () => {
    expect(isConnectionFailure(new TypeError("x is not a function"))).toBe(false);
  });
});
