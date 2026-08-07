import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fieldHintId } from "@/components/ui/field";

/**
 * A guard on the wizard's vertical rhythm.
 *
 * This is a lint-style test rather than a behavioural one, and it exists
 * because the thing it protects is not expressible any other way. The wizard
 * accumulated **eight** competing vertical spacing values — 2, 4, 6, 8, 12, 16,
 * 20, 24 and 32px — with `space-y-2` (8px) alone doing four different jobs:
 * label→control, control→helper, item→item, and card-title→description.
 *
 * The result was that the largest ratio anywhere was 2:1, and in the document
 * pickers it was 1.5:1 (12px between fields, 8px inside one). At that ratio the
 * eye cannot tell where a field ends, which is exactly what was reported: "it
 * is not clear where each field ends because there is no gap, so everything
 * reads like a long paragraph."
 *
 * Nothing owned the scale, so it drifted. `Field` and `FieldSection` own it
 * now, and this test stops the intermediate values coming back one convenient
 * `space-y-3` at a time.
 *
 * It reads the sources rather than rendering them: the suite is
 * `environment: "node"` with `include: ["src/**\/*.test.ts"]`, so there is no
 * DOM here to assert computed styles against.
 */

const SETUP_DIR = join(process.cwd(), "src/components/setup");

/**
 * Utility tokens from `className` attributes only.
 *
 * Prose matters here — several files discuss the old values in comments
 * ("it used to be `mt-4`"), and a naive grep over the whole file would flag
 * the explanation of the bug as the bug.
 */
function classTokens(source: string): string[] {
  const tokens: string[] = [];
  const attribute = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g;

  for (const match of source.matchAll(attribute)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    for (const token of value.split(/\s+/)) {
      // Strip variant prefixes: `sm:gap-6` is still a gap-6.
      const bare = token.includes(":")
        ? token.slice(token.lastIndexOf(":") + 1)
        : token;
      if (bare) tokens.push(bare);
    }
  }
  return tokens;
}

function setupFiles(): Array<{ name: string; tokens: string[] }> {
  return readdirSync(SETUP_DIR)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => ({
      name,
      tokens: classTokens(readFileSync(join(SETUP_DIR, name), "utf8")),
    }));
}

describe("the setup wizard's vertical rhythm", () => {
  it("finds files to check", () => {
    // A rename or a moved directory would otherwise turn every assertion
    // below into a silent pass over an empty list.
    const files = setupFiles();
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files.some((file) => file.tokens.length > 0)).toBe(true);
  });

  it("uses no in-between stack values", () => {
    // 12px and 20px were the two that destroyed the ratios: `space-y-3`
    // between fields against `space-y-2` inside one is 1.5:1. Every gap now
    // means exactly one thing — 8px inside a field, 24px between fields,
    // 32px between sections.
    const banned = ["space-y-3", "space-y-5", "space-y-7", "space-y-9"];

    for (const file of setupFiles()) {
      for (const token of banned) {
        expect(file.tokens, `${file.name} uses ${token}`).not.toContain(token);
      }
    }
  });

  it("does not reintroduce the margins that fought the stack", () => {
    // `mt-4` in persona-step and `mb-4` beside it were no-ops — they collapsed
    // against the parent `space-y-4`'s existing 16px — while reading like
    // deliberate spacing. `mt-5` produced a 20px gap that existed nowhere else.
    // Small optical nudges (`mt-0.5`, `mt-1`, `mt-1.5`, `mt-2`) are fine and
    // are not stack rhythm.
    const banned = ["mt-3", "mt-4", "mt-5", "mb-3", "mb-4", "mb-5"];

    for (const file of setupFiles()) {
      for (const token of banned) {
        expect(file.tokens, `${file.name} uses ${token}`).not.toContain(token);
      }
    }
  });

  it("keeps a field's own gap smaller than the gap between fields", () => {
    // The whole point, stated as arithmetic. If both of these are present the
    // ratio is 3:1; the failure mode being guarded against is someone
    // "tidying" the 24px back down to 16px, which returns it to 2:1.
    const tokens = setupFiles().flatMap((file) => file.tokens);
    expect(tokens).toContain("space-y-2");
    expect(tokens).toContain("space-y-6");
  });
});

describe("fieldHintId", () => {
  it("matches the id Field gives its hint, so a control can point at it", () => {
    expect(fieldHintId("role-title")).toBe("role-title-hint");
  });
});
