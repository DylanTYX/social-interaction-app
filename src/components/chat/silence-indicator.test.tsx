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
    expect(
      renderToStaticMarkup(<SilenceIndicator silenceStartedAtMs={null} />),
    ).toBe("");
  });

  it("draws nothing before the warning threshold", () => {
    // The pause has only just begun; announcing it here would flicker on every
    // ordinary between-sentence breath.
    const justPaused = Date.now() - (SILENCE_WARN_AT_MS - 500);
    expect(
      renderToStaticMarkup(
        <SilenceIndicator silenceStartedAtMs={justPaused} />,
      ),
    ).toBe("");
  });
});
