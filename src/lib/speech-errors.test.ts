import { describe, expect, it } from "vitest";

import { describeSpeechError } from "@/lib/speech-errors";

/**
 * The recorders show what this returns. The cases below are the SDK's own
 * strings, as they reach `onError` in `speech-service.ts`.
 */
describe("describeSpeechError", () => {
  it("explains an abnormal websocket close", () => {
    const message = describeSpeechError(
      "Speech recognition error: websocket error code: 1006",
    );
    expect(message).toContain("connection to the speech service dropped");
    expect(message).not.toContain("1006");
  });

  it("explains a refused microphone permission", () => {
    expect(
      describeSpeechError(
        "Microphone permission denied. Please allow access in browser settings.",
      ),
    ).toContain("blocking the microphone");
  });

  it("explains a microphone another app holds", () => {
    expect(
      describeSpeechError("Failed to start listening: NotReadableError"),
    ).toContain("Another app is using your microphone");
  });

  it("keeps an unrecognised failure rather than hiding it", () => {
    expect(describeSpeechError("Speech recognition error: unknown")).toBe(
      "Speech recognition error: unknown",
    );
  });

  it("passes null through, so an absent error stays absent", () => {
    expect(describeSpeechError(null)).toBeNull();
  });
});
