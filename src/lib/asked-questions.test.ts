import { describe, expect, it } from "vitest";

import { extractQuestion, formatAskedQuestions } from "@/lib/asked-questions";

/**
 * Keeping the interviewer from asking the same thing twice.
 *
 * The don't-repeat instruction pointed at the rolling summary, which keeps
 * three turns verbatim and compresses the rest into under 180 words — so by
 * turn ten whether an earlier question survived was up to the summariser.
 */

const turn = (role: "user" | "assistant", content: string) => ({
  role,
  content,
});

describe("extractQuestion", () => {
  it("takes the question, not the acknowledgement before it", () => {
    expect(
      extractQuestion(
        "That's a clear example, thank you. What would you do differently now?",
      ),
    ).toBe("What would you do differently now?");
  });

  it("takes the last question when a turn asks more than one", () => {
    expect(extractQuestion("Who owned it? And what was the outcome?")).toBe(
      "And what was the outcome?",
    );
  });

  it("keeps an imperative prompt that carries no question mark", () => {
    expect(extractQuestion("Walk me through your approach.")).toBe(
      "Walk me through your approach.",
    );
  });

  it("returns null for an empty turn", () => {
    expect(extractQuestion("   ")).toBeNull();
  });
});

describe("formatAskedQuestions", () => {
  it("lists what has been asked, oldest first", () => {
    const block = formatAskedQuestions([
      turn("assistant", "Tell me about a conflict you handled."),
      turn("user", "I once had a disagreement about scope."),
      turn("assistant", "What was your role in resolving it?"),
    ]);

    expect(block).toContain("- Tell me about a conflict you handled.");
    expect(block).toContain("- What was your role in resolving it?");
    // The candidate's own words are not what the interviewer needs to recall.
    expect(block).not.toContain("disagreement about scope");
  });

  it("does not list the same question twice", () => {
    const block = formatAskedQuestions([
      turn("assistant", "What was the outcome?"),
      turn("assistant", "what was the outcome?"),
    ]);

    expect(block?.match(/What was the outcome\?/gi)).toHaveLength(1);
  });

  it("returns null before anything has been asked", () => {
    // Turn one: there is nothing to avoid repeating, and an empty heading in
    // the prompt is pure noise.
    expect(formatAskedQuestions([])).toBeNull();
    expect(formatAskedQuestions([turn("user", "I'm ready.")])).toBeNull();
  });

  it("keeps the most recent questions when there are many", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      turn("assistant", `Question number ${i}?`),
    );

    const block = formatAskedQuestions(many);
    // The oldest drop first — those are the ones the rolling summary is most
    // likely to still cover.
    expect(block).toContain("Question number 19?");
    expect(block).not.toContain("Question number 0?");
  });
});
