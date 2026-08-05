import { describe, expect, it } from "vitest";

import {
  createDefaultInterviewLoop,
  normalizeInterviewLoop,
  resolveAnswerFormat,
} from "@/lib/interview-rounds";

describe("normalizeInterviewLoop", () => {
  it("preserves an explicit answerFormat", () => {
    // Regression guard. `normalizeInterviewLoop` rebuilds each round
    // field-by-field, and it used to omit `answerFormat`. Since every read path
    // normalizes — localStorage load and the server launch meta — the setup
    // wizard's choice never survived to the interview screen, which made the
    // whole coding-round feature inert.
    const loop = normalizeInterviewLoop(
      {
        enabled: false,
        templateId: "single",
        breakMinutes: 0,
        currentRoundIndex: 0,
        rounds: [
          {
            id: "r1",
            title: "Round 1",
            type: "behavioral",
            durationMinutes: 15,
            practiceMode: "text",
            focus: "Practice.",
            answerFormat: "code",
          },
        ],
      },
      "text",
    );

    expect(loop.rounds[0].answerFormat).toBe("code");
    expect(resolveAnswerFormat(loop.rounds[0])).toBe("code");
  });

  it("preserves an explicit opt-out on a technical round", () => {
    const loop = normalizeInterviewLoop(
      {
        rounds: [
          {
            id: "r1",
            title: "Round 1",
            type: "technical_swe",
            durationMinutes: 15,
            practiceMode: "text",
            focus: "Practice.",
            answerFormat: "prose",
          },
        ],
      },
      "text",
    );

    // Without the opt-out this would default to "code" on its round type.
    expect(resolveAnswerFormat(loop.rounds[0])).toBe("prose");
  });

  it("leaves answerFormat undefined when none was chosen", () => {
    const loop = normalizeInterviewLoop(
      {
        rounds: [
          {
            id: "r1",
            title: "Round 1",
            type: "technical_swe",
            durationMinutes: 15,
            practiceMode: "text",
            focus: "Practice.",
          },
        ],
      },
      "text",
    );

    expect(loop.rounds[0].answerFormat).toBeUndefined();
    // Falls back to the round-type default.
    expect(resolveAnswerFormat(loop.rounds[0])).toBe("code");
  });

  it("ignores a bad stored value rather than trusting it", () => {
    const loop = normalizeInterviewLoop(
      {
        rounds: [
          {
            id: "r1",
            title: "Round 1",
            type: "behavioral",
            durationMinutes: 15,
            practiceMode: "text",
            focus: "Practice.",
            // Anything can be in localStorage.
            answerFormat: "diagram" as unknown as "code",
          },
        ],
      },
      "text",
    );

    expect(loop.rounds[0].answerFormat).toBeUndefined();
  });

  it("clamps round duration and falls back on a bad round type", () => {
    const loop = normalizeInterviewLoop(
      {
        rounds: [
          {
            id: "r1",
            title: "Round 1",
            type: "nonsense" as unknown as "behavioral",
            durationMinutes: 999,
            practiceMode: "text",
            focus: "Practice.",
          },
        ],
      },
      "text",
    );

    expect(loop.rounds[0].type).toBe("behavioral");
    expect(loop.rounds[0].durationMinutes).toBe(90);
  });

  it("marks a single-round loop as not enabled", () => {
    // `enabled` means "is a multi-round loop", not "has a configured round".
    const loop = normalizeInterviewLoop(
      { enabled: true, rounds: createDefaultInterviewLoop().rounds },
      "text",
    );
    expect(loop.enabled).toBe(false);
  });
});
