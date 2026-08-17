import { describe, expect, it } from "vitest";

import {
  describeCode,
  formatCodeAnswer,
  isCodeLanguage,
  parseCodeAnswer,
} from "@/lib/code-answer";
import { resolveAnswerFormat } from "@/lib/interview-rounds";

describe("formatCodeAnswer / parseCodeAnswer", () => {
  it("round-trips code and language", () => {
    const code = "def solve(n):\n    return n * 2";
    const parsed = parseCodeAnswer(formatCodeAnswer(code, "python"));

    expect(parsed?.language).toBe("python");
    expect(parsed?.code).toBe(code);
    expect(parsed?.note).toBe("");
  });

  it("round-trips an accompanying note", () => {
    const parsed = parseCodeAnswer(
      formatCodeAnswer("SELECT 1;", "sql", "  Assuming one row per user.  "),
    );

    expect(parsed?.note).toBe("Assuming one row per user.");
    expect(parsed?.code).toBe("SELECT 1;");
  });

  it("separates prose written on both sides of the fence", () => {
    // These used to be concatenated with no separator, producing
    // "my approachthe complexity is O(n)".
    const parsed = parseCodeAnswer(
      "My approach:\n\n```python\npass\n```\n\nThe complexity is O(n).",
    );

    expect(parsed?.note).toBe("My approach:\n\nThe complexity is O(n).");
  });

  it("returns null for a prose answer, leaving normal turns untouched", () => {
    expect(parseCodeAnswer("I led a team of four engineers.")).toBeNull();
    expect(parseCodeAnswer("")).toBeNull();
  });

  it("reports an unknown fence language as null rather than guessing", () => {
    const parsed = parseCodeAnswer("```haskell\nmain = pure ()\n```");
    expect(parsed?.language).toBeNull();
    expect(parsed?.code).toBe("main = pure ()");
  });

  it("preserves blank lines and indentation inside the block", () => {
    const code = "class A:\n\n    def b(self):\n        pass";
    expect(parseCodeAnswer(formatCodeAnswer(code, "python"))?.code).toBe(code);
  });
});

describe("isCodeLanguage", () => {
  it("accepts supported languages and rejects others", () => {
    expect(isCodeLanguage("python")).toBe(true);
    expect(isCodeLanguage("typescript")).toBe(true);
    expect(isCodeLanguage("brainfuck")).toBe(false);
  });
});

describe("describeCode", () => {
  it("counts non-blank lines", () => {
    expect(describeCode("a\n\nb\n")).toBe("2 lines");
    expect(describeCode("only")).toBe("1 line");
  });
});

describe("resolveAnswerFormat", () => {
  const round = {
    type: "technical_swe" as const,
    practiceMode: "text" as const,
  };

  it("defaults technical SWE rounds to the editor", () => {
    expect(resolveAnswerFormat(round)).toBe("code");
  });

  it("defaults every other round type to prose", () => {
    expect(
      resolveAnswerFormat({ ...round, type: "behavioral" }),
    ).toBe("prose");
    expect(
      resolveAnswerFormat({ ...round, type: "system_design" }),
    ).toBe("prose");
  });

  it("honours an explicit opt-out on a type that supports code", () => {
    expect(resolveAnswerFormat({ ...round, answerFormat: "prose" })).toBe(
      "prose",
    );
  });

  it("refuses a code override on a type that has no editor", () => {
    // Behaviour change, and the point of the round-type registry. This used to
    // return "code": the override beat the type. That is how a behavioural
    // round ended up with a code editor — the wizard offered the toggle
    // because it gated on practice mode rather than round type, and once the
    // value was written it won.
    //
    // Saved loops and localStorage payloads still carry those values, so
    // refusing them here is what actually fixes it rather than just hiding
    // the control.
    for (const type of ["behavioral", "screening", "hr", "case", "system_design"] as const) {
      expect(
        resolveAnswerFormat({ ...round, type, answerFormat: "code" }),
        type,
      ).toBe("prose");
    }

    // The one type that does support an editor still honours the override.
    expect(
      resolveAnswerFormat({
        ...round,
        type: "technical_swe",
        answerFormat: "code",
      }),
    ).toBe("code");
  });

  it("opens a voice technical round on discussion, not on the editor", () => {
    // Voice sets the *default* only. The round opens the way its
    // `opening` instruction does — state the problem, invite thinking out loud
    // — so it starts in prose with the editor a tap away.
    expect(
      resolveAnswerFormat({ ...round, practiceMode: "voice" }),
    ).toBe("prose");
  });

  it("honours a code override in voice mode", () => {
    // Behaviour change. This used to return "prose" before the round type was
    // even consulted, so a voice technical round was a spoken discussion scored
    // on correctness, complexity and code quality — the rubric asking for
    // something the interface could not accept.
    expect(
      resolveAnswerFormat({
        ...round,
        practiceMode: "voice",
        answerFormat: "code",
      }),
    ).toBe("code");
  });

  it("still refuses a code override in voice mode on a prose-only type", () => {
    // The type guard runs before the mode, so lifting the voice block did not
    // reopen the hole it used to mask.
    expect(
      resolveAnswerFormat({
        ...round,
        type: "behavioral",
        practiceMode: "voice",
        answerFormat: "code",
      }),
    ).toBe("prose");
  });

  it("falls back to prose when there is no round", () => {
    expect(resolveAnswerFormat(undefined)).toBe("prose");
  });
});
