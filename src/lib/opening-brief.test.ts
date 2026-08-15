import { describe, expect, it } from "vitest";

import {
  buildOpeningInstruction,
  NO_READINESS_CHECK,
} from "@/lib/opening-brief";
import { ROUND_TYPES } from "@/lib/interview-rounds";
import { ROUND_TYPE_SPECS } from "@/lib/round-types";

/**
 * The interviewer's first turn.
 *
 * The thing under test is mostly a string, so these assert the properties that
 * caused real problems rather than the wording: that no round asks permission
 * to begin, that each round carries its own opening question, and that a loop
 * round refers back instead of introducing the day from scratch.
 */

describe("buildOpeningInstruction", () => {
  it("never asks whether the candidate is ready, on any round type", () => {
    // This is the regression that matters. The old shared instruction ended
    // "ask if they're ready to begin", so the candidate answered "yes" —
    // matched by TRIVIAL_ANSWER in the chat route, skipped by the analyzer,
    // and still counted as a turn. The first exchange scored nothing.
    for (const roundType of ROUND_TYPES) {
      const instruction = buildOpeningInstruction({ roundType });

      expect(instruction).toContain(NO_READINESS_CHECK);
      expect(instruction).not.toMatch(/ready to begin/i);
      expect(instruction).not.toMatch(/are you ready/i);
    }
  });

  it("carries the opening question belonging to each round type", () => {
    for (const roundType of ROUND_TYPES) {
      expect(buildOpeningInstruction({ roundType })).toContain(
        ROUND_TYPE_SPECS[roundType].opening,
      );
    }
  });

  it("opens a technical round on the problem, not on small talk", () => {
    const technical = buildOpeningInstruction({ roundType: "technical_swe" });
    const screening = buildOpeningInstruction({ roundType: "screening" });

    expect(technical).toMatch(/coding problem/i);
    // "Tell me about yourself" belongs to the screening round and must not
    // leak into a round whose rubric is correctness and complexity.
    expect(technical).not.toMatch(/introduce themselves/i);
    expect(screening).toMatch(/introduce themselves/i);
  });

  it("asks a loop round to refer back to the earlier round", () => {
    const continued = buildOpeningInstruction({
      roundType: "system_design",
      loopBrief: "Round 1 covered the payments migration.",
    });

    expect(continued).toMatch(/not the first interviewer/i);
    expect(continued).toMatch(/handoff notes/i);
    // Still asks its own question — the callback replaces the framing sentence,
    // not the round's opening.
    expect(continued).toContain(ROUND_TYPE_SPECS.system_design.opening);
  });

  it("treats a cold open as a cold open even inside a loop", () => {
    // Round 1 of a loop has no handoff to refer to. Presence of the brief is
    // the signal, not the round index, which is why the input takes the brief.
    const first = buildOpeningInstruction({
      roundType: "screening",
      loopBrief: null,
    });
    const blank = buildOpeningInstruction({
      roundType: "screening",
      loopBrief: "   ",
    });

    expect(first).not.toMatch(/not the first interviewer/i);
    expect(blank).not.toMatch(/not the first interviewer/i);
  });

  it("falls back to the behavioural opening when no round is configured", () => {
    expect(buildOpeningInstruction({})).toContain(
      ROUND_TYPE_SPECS.behavioral.opening,
    );
  });

  it("tells the interviewer to use the identity it was given", () => {
    // The persona prompt supplies name, seniority, industry and years; without
    // this line the model introduces itself as a generic interviewer and the
    // persona configuration is invisible in the one turn that sets the tone.
    const instruction = buildOpeningInstruction({ roundType: "hr" });

    expect(instruction).toMatch(/introduce yourself by name/i);
    expect(instruction).toMatch(/do not invent a different one/i);
  });
});
