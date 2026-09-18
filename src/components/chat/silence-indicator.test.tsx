import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SilenceIndicator } from "@/components/chat/silence-indicator";
import { SILENCE_WARN_AT_MS } from "@/lib/silence-detection";

/**
 * The first `.tsx` test in the repo.
 *
 * It exists as much to prove the runner collects `.test.tsx` at all as to test
 * this component — the glob used to be `.test.ts` only, so a file like this was
 * silently ignored.
 *
 * Rendered to static markup rather than mounted: the interesting behaviour here
 * is what the component *refuses* to draw, which needs no DOM at all. A test
 * that needs one gets jsdom automatically via `environmentMatchGlobs`.
 */

describe("SilenceIndicator", () => {
  it("draws nothing while the candidate is still speaking", () => {
    expect(renderToStaticMarkup(<SilenceIndicator deadline={null} />)).toBe("");
  });

  it("draws nothing on its first render, before it has read the clock", () => {
    // The first sample is taken on a microtask, so the effect body holds no
    // synchronous setState. Server-rendered, that sample never happens.
    expect(
      renderToStaticMarkup(
        <SilenceIndicator
          deadline={{ atMs: Date.now() + SILENCE_WARN_AT_MS, pending: "submit" }}
        />,
      ),
    ).toBe("");
  });
});
