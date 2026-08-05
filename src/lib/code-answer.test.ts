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

  it("honours an explicit override", () => {
    expect(resolveAnswerFormat({ ...round, answerFormat: "prose" })).toBe(
      "prose",
    );
    expect(
      resolveAnswerFormat({
        ...round,
        type: "case",
        answerFormat: "code",
      }),
    ).toBe("code");
  });

  it("forces prose in voice mode — there is no editor to type into", () => {
    expect(
      resolveAnswerFormat({
        ...round,
        practiceMode: "voice",
        answerFormat: "code",
      }),
    ).toBe("prose");
  });

  it("falls back to prose when there is no round", () => {
    expect(resolveAnswerFormat(undefined)).toBe("prose");
  });
});
