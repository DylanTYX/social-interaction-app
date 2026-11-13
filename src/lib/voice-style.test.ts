/**
 * Warmth in the voice, for the few voices that can carry it. The rules that
 * matter: only a warm persona gets a style, only a voice that has a fitting
 * one, and never a style that could flatten the accent the persona exists for.
 */

import { describe, expect, it } from "vitest";

import { ACCENT_VOICES, voiceStyleFor } from "@/lib/speech-voices";

describe("voiceStyleFor", () => {
  it("gives a warm persona its voice's warm style", () => {
    expect(voiceStyleFor("en-US-AriaNeural", 9)).toBe("friendly");
    expect(voiceStyleFor("en-IN-NeerjaNeural", 8)).toBe("empathetic");
    expect(voiceStyleFor("zh-CN-XiaoxiaoNeural", 10)).toBe("gentle");
  });

  it("speaks plainly below the warm band, whatever the voice", () => {
    for (const warmth of [1, 5, 7]) {
      expect(voiceStyleFor("en-US-AriaNeural", warmth)).toBeNull();
    }
  });

  it("speaks plainly for a voice with no fitting style", () => {
    expect(voiceStyleFor("en-SG-LunaNeural", 10)).toBeNull();
    expect(voiceStyleFor("es-ES-ElviraNeural", 10)).toBeNull();
  });

  it("handles a missing voice or warmth without guessing", () => {
    expect(voiceStyleFor(undefined, 10)).toBeNull();
    expect(voiceStyleFor("en-US-AriaNeural", undefined)).toBeNull();
  });

  it("only ever styles voices that are in the catalogue and verified", () => {
    const usable = new Set(
      ACCENT_VOICES.filter((voice) => voice.verified).map((voice) => voice.uri),
    );
    for (const uri of [
      "en-US-AriaNeural",
      "en-US-GuyNeural",
      "en-IN-NeerjaNeural",
      "zh-CN-XiaoxiaoNeural",
    ]) {
      expect(usable.has(uri)).toBe(true);
    }
  });
});
