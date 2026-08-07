import { describe, expect, it } from "vitest";

import {
  RECENT_MESSAGES_KEPT,
  SUMMARY_REFRESH_MESSAGES,
  selectMessagesToSummarize,
  selectRecentMessages,
  shouldRefreshSummary,
} from "@/lib/summary";

function conversation(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `message ${i}`,
  }));
}

describe("selectRecentMessages", () => {
  it("returns everything for a short conversation", () => {
    const messages = conversation(RECENT_MESSAGES_KEPT);
    expect(selectRecentMessages(messages)).toEqual(messages);
  });

  it("keeps only the tail once the conversation grows", () => {
    const messages = conversation(20);
    const recent = selectRecentMessages(messages);

    expect(recent).toHaveLength(RECENT_MESSAGES_KEPT);
    expect(recent[recent.length - 1].content).toBe("message 19");
  });
});

describe("selectMessagesToSummarize", () => {
  it("summarizes nothing while everything still fits verbatim", () => {
    expect(selectMessagesToSummarize(conversation(RECENT_MESSAGES_KEPT))).toBe(
      null,
    );
  });

  it("summarizes everything ahead of the verbatim tail", () => {
    const older = selectMessagesToSummarize(conversation(10));
    expect(older).toHaveLength(10 - RECENT_MESSAGES_KEPT);
    expect(older?.[0].content).toBe("message 0");
  });

  it("partitions the conversation without gaps or overlap", () => {
    const messages = conversation(15);
    const older = selectMessagesToSummarize(messages) ?? [];
    const recent = selectRecentMessages(messages);

    expect([...older, ...recent]).toEqual(messages);
  });
});

describe("shouldRefreshSummary", () => {
  it("does not refresh while the whole conversation fits verbatim", () => {
    expect(shouldRefreshSummary(RECENT_MESSAGES_KEPT, false)).toBe(false);
    expect(shouldRefreshSummary(RECENT_MESSAGES_KEPT, true)).toBe(false);
  });

  it("builds the first summary as soon as messages age out", () => {
    expect(shouldRefreshSummary(RECENT_MESSAGES_KEPT + 1, false)).toBe(true);
  });

  it("then refreshes every SUMMARY_REFRESH_TURNS turns", () => {
    // This assertion used to read `shouldRefreshSummary(9, true) === false`,
    // encoding the old message-parity behaviour — which is exactly what broke
    // voice. The cadence counts turns now, so 8 and 9 messages are both "turn
    // 4" and both refresh.
    expect(shouldRefreshSummary(8, true)).toBe(true);
    expect(shouldRefreshSummary(9, true)).toBe(true);
    expect(shouldRefreshSummary(10, true)).toBe(false);
    expect(shouldRefreshSummary(12, true)).toBe(true);
  });

  it("refreshes a VOICE session, whose message count is always odd", () => {
    // The bug this replaces. Voice opens with one assistant greeting, so its
    // message count runs 1, 3, 5, 7… and the old check was `count % 4 === 0`,
    // which an odd number can never satisfy. Every voice interview summarised
    // once and never again, so from turn four the interviewer was steering off
    // a frozen summary and re-asking ground it had covered.
    const refreshes = simulate({ startsOdd: true });
    expect(refreshes.length).toBeGreaterThan(2);
  });

  it("refreshes a TEXT session at the same cadence", () => {
    const voice = simulate({ startsOdd: true }).length;
    const text = simulate({ startsOdd: false }).length;
    // The property that matters: parity must not decide how often a session is
    // summarised.
    expect(Math.abs(voice - text)).toBeLessThanOrEqual(1);
  });

  it("never lets more than SUMMARY_REFRESH_MESSAGES age out, in either mode", () => {
    // The chat route sizes its transcript read window from this invariant, so
    // a cadence change must not silently break the window.
    //
    // Measured only *after* the first summary exists. Before that there is
    // nothing to age out — everything still fits in the verbatim window, which
    // is why `shouldRefreshSummary` returns false below RECENT_MESSAGES_KEPT.
    for (const startsOdd of [true, false]) {
      let sinceRefresh = 0;
      let worst = 0;
      let hasSummary = false;
      for (let total = startsOdd ? 1 : 2; total <= 60; total += 2) {
        if (hasSummary) sinceRefresh += 2;
        if (shouldRefreshSummary(total, hasSummary)) {
          sinceRefresh = 0;
          hasSummary = true;
        }
        worst = Math.max(worst, sinceRefresh);
      }
      expect(worst, startsOdd ? "voice" : "text").toBeLessThanOrEqual(
        SUMMARY_REFRESH_MESSAGES,
      );
    }
  });
});

/**
 * Walk a real session's message counts and record when it summarises.
 *
 * Modelled the way sessions actually run: the summary starts absent and is
 * created by the `!hasExistingSummary` branch, after which the cadence applies.
 * Voice adds a lone opening greeting first, so its counts are odd throughout.
 */
function simulate({ startsOdd }: { startsOdd: boolean }): number[] {
  const refreshes: number[] = [];
  let hasSummary = false;
  for (let total = startsOdd ? 1 : 2; total <= 40; total += 2) {
    if (shouldRefreshSummary(total, hasSummary)) {
      refreshes.push(total);
      hasSummary = true;
    }
  }
  return refreshes;
}
