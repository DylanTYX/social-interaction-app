import { describe, expect, it } from "vitest";

import {
  RECENT_MESSAGES_KEPT,
  SUMMARY_REFRESH_EVERY,
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

  it("then refreshes on the fixed cadence", () => {
    expect(shouldRefreshSummary(8, true)).toBe(true); // 8 % 4 === 0
    expect(shouldRefreshSummary(9, true)).toBe(false);
    expect(shouldRefreshSummary(12, true)).toBe(true);
  });

  it("never lets more than SUMMARY_REFRESH_EVERY messages age out unsummarized", () => {
    // The chat route sizes its transcript read window from this invariant, so
    // a change to the cadence must not silently break the window.
    let sinceRefresh = 0;
    for (let total = RECENT_MESSAGES_KEPT + 1; total <= 60; total += 1) {
      sinceRefresh += 1;
      if (shouldRefreshSummary(total, true)) sinceRefresh = 0;
      expect(sinceRefresh).toBeLessThanOrEqual(SUMMARY_REFRESH_EVERY);
    }
  });
});
