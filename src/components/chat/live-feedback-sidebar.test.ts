import { describe, expect, it } from "vitest";

/**
 * The rail's third measure was labelled "Speaking pace" and scored how close
 * an answer's word count came to 95. It showed a pace for typed answers, and
 * in a voice interview it could read 38% beside a note saying "148 wpm". These
 * pin what it shows now: the real pace when you speak, the length when you
 * type.
 */

import { buildMetricChips } from "@/components/chat/live-feedback-sidebar";
import type { AnalysisResult } from "@/lib/response-analyzer";
import type { DeliverySnapshot } from "@/lib/session-launch-meta";

function answer(words: number): AnalysisResult {
  return {
    confidenceIndicators: { assertivenessScore: 7 },
    responseQuality: { isRelevant: true, length: words },
    specificityMetrics: { vaguenessScore: 3 },
  } as unknown as AnalysisResult;
}

function spoken(wpm: number | null): DeliverySnapshot {
  return {
    wpm,
    wordCount: 120,
    durationSeconds: 50,
    fillerCount: 0,
    longPauseCount: 0,
    recordedAt: "2026-09-27T00:00:00.000Z",
  };
}

const third = (chips: ReturnType<typeof buildMetricChips>) => chips[2];

describe("the live coaching rail's third measure", () => {
  it("is the answer's length in words in a text interview", () => {
    const chip = third(buildMetricChips(null, [answer(34)], "text"));
    expect(chip).toMatchObject({ label: "Answer length", value: 34, unit: "words" });
  });

  it("does not mark a short answer down", () => {
    // The old score floored a 30-word answer at 38%, the same as a 160-word one.
    const short = third(buildMetricChips(null, [answer(30)], "text"));
    const long = third(buildMetricChips(null, [answer(160)], "text"));
    expect([short.value, long.value]).toEqual([30, 160]);
  });

  it("is the speaking pace from the speech in a voice interview", () => {
    const chip = third(
      buildMetricChips(null, [answer(34), answer(90)], "voice", [
        spoken(132),
        spoken(148),
      ]),
    );
    expect(chip).toMatchObject({ label: "Speaking pace", value: 148, unit: "wpm" });
    expect(chip.trend).toHaveLength(2);
  });

  it("skips an answer too short to time, rather than plotting it as zero", () => {
    const chip = third(
      buildMetricChips(null, [answer(5), answer(90)], "voice", [
        spoken(140),
        spoken(null),
      ]),
    );
    expect(chip.value).toBe(140);
    expect(chip.trend).toHaveLength(1);
  });

  it("shows nothing before the first spoken answer", () => {
    expect(third(buildMetricChips(null, [], "voice")).value).toBeNull();
  });

  it("keeps the other three measures as percentages in both modes", () => {
    for (const mode of ["text", "voice"] as const) {
      const units = buildMetricChips(null, [], mode).map((chip) => chip.unit);
      expect([units[0], units[1], units[3]]).toEqual(["%", "%", "%"]);
    }
  });
});
