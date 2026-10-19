import { describe, expect, it } from "vitest";

import { extractQuestion } from "@/lib/asked-questions";
import {
  CODE_TIME_UP_NOTE,
  isTimedOutCodeAnswer,
} from "@/lib/chat-contract";
import { formatCodeAnswer } from "@/lib/code-answer";
import {
  latestProblemStatement,
  splitProblemStatement,
} from "@/lib/problem-statement";

const MESSAGE = [
  "I'm Priya, I lead the payments platform team. Let's start with a coding problem.",
  "",
  "```problem",
  "Two sum",
  "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
  "Example: nums = [2, 7, 11, 15], target = 9 → [0, 1]",
  "```",
  "",
  "It's on screen — take a minute, and think out loud before you write any code.",
].join("\n");

describe("splitProblemStatement", () => {
  it("separates what is said from the written problem", () => {
    const { spoken, problem } = splitProblemStatement(MESSAGE);

    expect(problem).toBe(
      [
        "Two sum",
        "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
        "Example: nums = [2, 7, 11, 15], target = 9 → [0, 1]",
      ].join("\n"),
    );
    expect(spoken).not.toContain("```");
    expect(spoken).not.toContain("nums = [2, 7, 11, 15]");
    expect(spoken).toContain("Let's start with a coding problem.");
    expect(spoken).toContain("think out loud");
  });

  it("shows a statement while it is still streaming", () => {
    // Mid-stream the closing fence has not arrived yet; the statement so far
    // is shown rather than nothing.
    const partial = MESSAGE.slice(0, MESSAGE.indexOf("Example"));
    const { problem, spoken } = splitProblemStatement(partial);

    expect(problem).toContain("Two sum");
    expect(spoken).not.toContain("Two sum");
  });

  it("leaves a message without a problem untouched", () => {
    const plain = "What was the hardest bug you have fixed?";
    expect(splitProblemStatement(plain)).toEqual({
      spoken: plain,
      problem: null,
    });
    // An ordinary code fence is not a problem statement.
    expect(
      splitProblemStatement("Consider this:\n```python\nx = 1\n```").problem,
    ).toBeNull();
  });
});

describe("latestProblemStatement", () => {
  it("finds the most recent problem the interviewer set", () => {
    const second = "```problem\nReverse a linked list\n```\nOver to you.";
    expect(
      latestProblemStatement([
        { role: "ai", content: MESSAGE },
        { role: "user", content: "```problem\nnot the interviewer's\n```" },
        { role: "ai", content: second },
        { role: "ai", content: "What is the complexity?" },
      ]),
    ).toBe("Reverse a linked list");
  });

  it("never takes a problem from the candidate", () => {
    expect(
      latestProblemStatement([
        { role: "user", content: "```problem\nmy own\n```" },
      ]),
    ).toBeNull();
  });
});

describe("extractQuestion with a written problem", () => {
  it("records the problem, not the spoken line around it", () => {
    // Otherwise "think out loud before you write any code" is what the
    // do-not-repeat list remembers, and the problem itself can be set twice.
    expect(extractQuestion(MESSAGE)).toBe("Two sum");
  });
});

describe("isTimedOutCodeAnswer", () => {
  it("recognises a code answer the clock sent", () => {
    const sent = `${formatCodeAnswer("def solve(): pass", "python")}\n\n${CODE_TIME_UP_NOTE}`;
    expect(isTimedOutCodeAnswer(sent)).toBe(true);
    expect(isTimedOutCodeAnswer(`${sent}\n`)).toBe(true);
  });

  it("ignores an answer the candidate submitted", () => {
    expect(
      isTimedOutCodeAnswer(formatCodeAnswer("def solve(): pass", "python")),
    ).toBe(false);
  });
});
