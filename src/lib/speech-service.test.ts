import { describe, expect, it } from "vitest";

import {
  appendUniqueTranscript,
  extractSpeakableSentences,
  paceToRatePercent,
} from "@/lib/speech-service";

describe("extractSpeakableSentences", () => {
  it("splits on sentence-ending punctuation", () => {
    const { sentences, rest } = extractSpeakableSentences(
      "Hello there, how are you doing today? I am fine.",
    );

    expect(sentences).toEqual([
      "Hello there, how are you doing today?",
      "I am fine.",
    ]);
    expect(rest).toBe("");
  });

  it("merges a too-short leading fragment into the next sentence", () => {
    // "Hi." alone would be a choppy one-word utterance, so it is held back
    // and emitted together with what follows.
    const { sentences } = extractSpeakableSentences(
      "Hi. Thanks for joining me today, let's begin.",
    );

    expect(sentences).toEqual([
      "Hi. Thanks for joining me today, let's begin.",
    ]);
  });

  it("does not split on a single newline", () => {
    // Streamed LLM replies are full of single newlines; splitting on them
    // produced one-word utterances.
    const { sentences } = extractSpeakableSentences(
      "Line one and some more text\nline two continues here and ends.",
    );

    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain("\n");
  });

  it("splits on a paragraph break when there is no sentence punctuation", () => {
    const { sentences } = extractSpeakableSentences(
      "First paragraph with enough length here\n\nSecond paragraph follows on",
      { flush: true },
    );

    expect(sentences).toEqual([
      "First paragraph with enough length here",
      "Second paragraph follows on",
    ]);
  });

  it("prefers a sentence terminator over a paragraph break", () => {
    // The boundary regex is an ordered alternation, so the punctuation branch
    // wins whenever a terminator exists anywhere in the buffer — even past the
    // blank line. In streaming use the later text has usually not arrived yet,
    // so this mostly matters on a flush.
    const { sentences } = extractSpeakableSentences(
      "First paragraph with enough length here\n\nSecond paragraph follows on.",
      { flush: true },
    );

    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain("\n\n");
  });

  it("holds an unterminated tail back until flushed", () => {
    const partial = "This sentence has no terminator yet";

    const held = extractSpeakableSentences(partial);
    expect(held.sentences).toEqual([]);
    expect(held.rest).toBe(partial);

    const flushed = extractSpeakableSentences(partial, { flush: true });
    expect(flushed.sentences).toEqual([partial]);
    expect(flushed.rest).toBe("");
  });

  it("returns nothing for an empty buffer", () => {
    expect(extractSpeakableSentences("", { flush: true })).toEqual({
      sentences: [],
      rest: "",
    });
  });
});

describe("appendUniqueTranscript", () => {
  it("appends when there is no overlap", () => {
    expect(appendUniqueTranscript("alpha", "beta")).toBe("alpha beta");
  });

  it("de-duplicates a repeated tail", () => {
    expect(appendUniqueTranscript("hello world", "hello world")).toBe(
      "hello world",
    );
  });

  it("merges a partial suffix/prefix overlap", () => {
    expect(appendUniqueTranscript("hello world", "world today")).toBe(
      "hello world today",
    );
    expect(
      appendUniqueTranscript(
        "I led the launch",
        "led the launch and saw a 12% lift",
      ),
    ).toBe("I led the launch and saw a 12% lift");
  });

  it("matches overlap case-insensitively but preserves original casing", () => {
    expect(appendUniqueTranscript("I led the Launch", "LED THE LAUNCH now")).toBe(
      "I led the Launch now",
    );
  });

  it("handles empty inputs on either side", () => {
    expect(appendUniqueTranscript("", "hello")).toBe("hello");
    expect(appendUniqueTranscript("hello", "")).toBe("hello");
    expect(appendUniqueTranscript("hello", "   ")).toBe("hello");
  });
});

describe("paceToRatePercent", () => {
  it("maps the persona pace dial onto an SSML rate delta", () => {
    expect(paceToRatePercent(5)).toBe(0);
    expect(paceToRatePercent(1)).toBe(-20);
    expect(paceToRatePercent(10)).toBe(25);
  });

  it("falls back to neutral for a missing or non-finite dial", () => {
    expect(paceToRatePercent(undefined)).toBe(0);
    expect(paceToRatePercent(Number.NaN)).toBe(0);
  });
});
