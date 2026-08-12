import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useAnswerTimer } from "@/hooks/use-answer-timer";

/**
 * The answer timer's two failure modes, both invisible in normal use.
 *
 * A hook test rather than a pure-function one because the bugs are in the
 * effect: what happens when the input is *disabled* mid-answer, and what
 * happens after `onExpire` succeeds. Neither is reachable from the return value.
 */

// React 19 checks this before rendering concurrently in tests.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const LIMIT_SECONDS = 300;

function renderTimer(onExpire: () => boolean) {
  const container = document.createElement("div");
  let root: Root;

  function Probe({ disabled }: { disabled: boolean }) {
    useAnswerTimer({ timeLimitSeconds: LIMIT_SECONDS, disabled, onExpire });
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(<Probe disabled={false} />);
  });

  return {
    setDisabled(disabled: boolean) {
      act(() => {
        root.render(<Probe disabled={disabled} />);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAnswerTimer", () => {
  it("submits once the deadline passes", () => {
    const onExpire = vi.fn(() => true);
    const timer = renderTimer(onExpire);

    act(() => {
      vi.advanceTimersByTime(LIMIT_SECONDS * 1000 + 500);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
    timer.unmount();
  });

  it("stops ticking after a successful submit", () => {
    // It used to latch `hasExpiredRef` and keep the 250ms interval running
    // until unmount, short-circuiting on every tick for nothing.
    const onExpire = vi.fn(() => true);
    const timer = renderTimer(onExpire);

    act(() => {
      vi.advanceTimersByTime(LIMIT_SECONDS * 1000 + 500);
    });
    expect(vi.getTimerCount()).toBe(0);

    // And it must not fire a second time.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    timer.unmount();
  });

  it("retries on the next tick when onExpire declines", () => {
    // `false` means "I could not submit" — the answer must not be dropped.
    const onExpire = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const timer = renderTimer(onExpire);

    // Exactly to the deadline: 300000 is a whole number of 250ms ticks, so
    // precisely one tick fires and it is the one that crosses the line.
    act(() => {
      vi.advanceTimersByTime(LIMIT_SECONDS * 1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onExpire).toHaveBeenCalledTimes(2);

    timer.unmount();
  });

  it("does not charge a disabled span to the candidate's clock", () => {
    // The real scenario: a send fails. `setUserTurnKey` is inside the try, so
    // the input is not remounted — it is merely disabled for the round-trip and
    // then re-enabled with its original deadline. A slow failure could leave
    // that deadline already past, and the timer auto-submitted the "no
    // response" placeholder on its first tick.
    const onExpire = vi.fn(() => true);
    const timer = renderTimer(onExpire);

    // Nearly the whole limit elapses while the candidate types.
    act(() => {
      vi.advanceTimersByTime(LIMIT_SECONDS * 1000 - 5_000);
    });

    // Send starts (input disabled), fails slowly, input re-enables.
    timer.setDisabled(true);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    timer.setDisabled(false);

    // Those 60s were not theirs to lose, so there is still time on the clock.
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(onExpire).not.toHaveBeenCalled();

    // The remaining ~5s still expires normally.
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    timer.unmount();
  });
});
