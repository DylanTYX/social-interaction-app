import { describe, expect, it } from "vitest";

import {
  buildJobDescriptionTitle,
  chunkJobDescription,
} from "@/lib/jd-chunking";

const MAX_CHARS_PER_CHUNK = 1200;

describe("chunkJobDescription", () => {
  it("returns nothing for empty or whitespace-only input", () => {
    expect(chunkJobDescription("")).toEqual([]);
    expect(chunkJobDescription("   \n\n  ")).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    const text = "We are hiring a backend engineer to own our payments API.";
    const chunks = chunkJobDescription(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
  });

  it("emits a single chunk even when it is below the minimum size", () => {
    // The `|| chunks.length === 0` guard exists so tiny inputs are not lost.
    const chunks = chunkJobDescription("Short JD.");
    expect(chunks).toHaveLength(1);
  });

  it("estimates tokens at roughly four characters each", () => {
    const text = "a".repeat(400);
    const [chunk] = chunkJobDescription(text);
    expect(chunk.tokenEstimate).toBe(100);
  });

  it("splits long text into overlapping chunks under the size cap", () => {
    const paragraph =
      "You will design and ship resilient services that handle real traffic. ";
    const text = paragraph.repeat(60); // ~4200 chars

    const chunks = chunkJobDescription(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHARS_PER_CHUNK);
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it("covers the whole document across chunks", () => {
    const text = Array.from(
      { length: 40 },
      (_, i) => `Requirement ${i}: ship reliable software with measurable impact.`,
    ).join("\n\n");

    const chunks = chunkJobDescription(text);
    const joined = chunks.map((c) => c.content).join(" ");

    // Every requirement line must survive somewhere in the chunk set.
    for (let i = 0; i < 40; i += 1) {
      expect(joined).toContain(`Requirement ${i}:`);
    }
  });

  it("terminates on text made entirely of short sentences", () => {
    // Regression guard: the cursor rewinds by OVERLAP_CHARS each iteration, so
    // a pathological input must still make forward progress.
    const chunks = chunkJobDescription("Go. ".repeat(800));
    expect(chunks.length).toBeGreaterThan(0);
  });
});

describe("buildJobDescriptionTitle", () => {
  it("prefers an explicit role title", () => {
    expect(
      buildJobDescriptionTitle({
        roleTitle: "  Staff Engineer  ",
        rawText: "Anything at all",
      }),
    ).toBe("Staff Engineer");
  });

  it("falls back to the first usable line of the document", () => {
    expect(
      buildJobDescriptionTitle({
        roleTitle: null,
        rawText: "Senior Platform Engineer\n\nAbout the role...",
      }),
    ).toBe("Senior Platform Engineer");
  });

  it("skips lines that are too short or too long to be a title", () => {
    const rawText = ["ab", "x".repeat(120), "Product Designer"].join("\n");
    expect(buildJobDescriptionTitle({ roleTitle: null, rawText })).toBe(
      "Product Designer",
    );
  });

  it("falls back to a generic label when no line qualifies", () => {
    expect(
      buildJobDescriptionTitle({ roleTitle: null, rawText: "ab" }),
    ).toBe("Job description");
  });
});
