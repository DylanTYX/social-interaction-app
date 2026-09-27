import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The landing page's mocks repeat labels from the screens they depict. Those
 * are typed on both sides, so a renamed label in the app would leave the page
 * describing a screen that no longer says that. Each label here must still
 * appear in the app file that renders it, and in the landing file that
 * copies it.
 */

const read = (path: string) =>
  readFileSync(join(process.cwd(), "src", path), "utf8");

const COPIED: [label: string, app: string, landing: string][] = [
  ["Live coaching", "components/chat/live-feedback-sidebar.tsx", "components/marketing/animated-demo.tsx"],
  ["Notes appear after each answer.", "components/chat/live-feedback-sidebar.tsx", "components/marketing/animated-demo.tsx"],
  ["No answers yet", "components/chat/live-feedback-sidebar.tsx", "components/marketing/animated-demo.tsx"],
  ["Coach is reviewing your answer…", "components/chat/chat-message.tsx", "components/marketing/animated-demo.tsx"],
  ["Your answer…", "components/chat/chat-input.tsx", "components/marketing/animated-demo.tsx"],
  ["this answer", "components/report/turn-score.tsx", "app/(marketing)/page.tsx"],
  ["Dimension profile", "app/simulate/report/[id]/page.tsx", "app/(marketing)/page.tsx"],
  ["Averaged across this round's scored answers, on the STAR", "app/simulate/report/[id]/page.tsx", "app/(marketing)/page.tsx"],
  ["Overall score", "app/simulate/report/[id]/page.tsx", "app/(marketing)/page.tsx"],
  ["vs last session", "components/report/score-comparison.tsx", "app/(marketing)/page.tsx"],
  ["STAR average", "app/simulate/report/[id]/page.tsx", "app/(marketing)/page.tsx"],
  ["Your answer, tightened", "components/coach/coaching-result.tsx", "app/(marketing)/page.tsx"],
  ["Your own facts, restructured. You could say this tomorrow.", "components/coach/coaching-result.tsx", "app/(marketing)/page.tsx"],
];

/** JSX text may break a sentence across lines or write an apostrophe as an entity. */
function normalise(source: string): string {
  return source
    .replace(/&apos;|&rsquo;/g, "'")
    .replace(/\s+/g, " ");
}

describe("labels the landing page copies from the app", () => {
  it.each(COPIED)("%j still appears in the app and on the page", (label, app, landing) => {
    expect(normalise(read(app))).toContain(label);
    expect(normalise(read(landing))).toContain(label);
  });
});
