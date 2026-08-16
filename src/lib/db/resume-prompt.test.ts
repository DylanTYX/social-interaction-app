import { describe, expect, it } from "vitest";

import { formatResumeForPrompt, MAX_RESUME_CHARS } from "@/lib/db/resumes";
import { describeTruncation } from "@/lib/document-truncation";

/**
 * What the interviewer is given when a resume is attached.
 *
 * The defect this pins shipped in migration 0008 and survived until now: a
 * `profile` column held a ~400-token summary written by `gpt-4o-mini`, and
 * `formatResumeForPrompt` returned it *instead of* the resume — an early return,
 * not a preference. So the interviewer had never read a candidate's actual
 * document, while its prompt label told it this was "their actual background"
 * and that it should "never invent experience that isn't here".
 *
 * The rule is simple enough to state in one line, which is why it is worth a
 * test: whatever is stored is what the interviewer reads.
 */

describe("formatResumeForPrompt", () => {
  it("returns the candidate's own text", () => {
    const resume =
      "Jane Doe\nSenior Engineer at Monzo\nLed the payments migration.";
    expect(formatResumeForPrompt({ rawText: resume })).toBe(resume);
  });

  it("ignores a legacy profile column entirely", () => {
    /**
     * Rows written before this change still carry a summary. Passing an object
     * that has one must not resurrect the substitution — the type no longer
     * admits `profile`, so this is the runtime half of that guarantee.
     */
    const resume = "Jane Doe\nLed the payments migration, 800ms p99 to 120ms.";
    const legacyRow = {
      rawText: resume,
      profile: "ROLES / Engineer at a bank",
    };

    expect(formatResumeForPrompt(legacyRow)).toBe(resume);
    expect(formatResumeForPrompt(legacyRow)).not.toContain("ROLES");
  });

  it("sends a long resume whole, up to the one remaining ceiling", () => {
    // The old prompt clip was 6,000 — inside a normal two-page resume, so ordinary
    // documents were cut rather than runaway ones. A 20,000-character resume must
    // now arrive intact.
    const resume = "Delivered a thing that mattered. ".repeat(600);
    expect(resume.length).toBeGreaterThan(6_000);
    expect(resume.length).toBeLessThan(MAX_RESUME_CHARS);

    expect(formatResumeForPrompt({ rawText: resume })).toBe(resume.trim());
  });

  it("marks the cut when a stored row somehow exceeds the ceiling", () => {
    // Unreachable through the upload path, which caps before storing. It stays
    // as a backstop for rows written when the cap was lower — and if it ever
    // fires, the interviewer must be able to see that it did.
    const resume = "x".repeat(MAX_RESUME_CHARS + 500);
    const formatted = formatResumeForPrompt({ rawText: resume });

    expect(formatted).toContain("…(resume truncated)");
    expect(formatted!.length).toBeLessThan(resume.length);
  });

  it("returns null for nothing at all", () => {
    expect(formatResumeForPrompt(null)).toBeNull();
    expect(formatResumeForPrompt({ rawText: "   " })).toBeNull();
  });
});

describe("describeTruncation", () => {
  it("says nothing when nothing was dropped", () => {
    // Used as the condition as well as the message, so the common case has to
    // be falsy rather than an empty string.
    expect(
      describeTruncation({ kind: "resume", kept: 24_000, original: 8_000 }),
    ).toBeNull();
  });

  it("names both real numbers, not just 'too long'", () => {
    const notice = describeTruncation({
      kind: "resume",
      kept: 24_000,
      original: 34_200,
    });

    // Knowing you lost 30% is what tells you whether to care; "too long" does
    // not. Both figures have to be in there, formatted for reading.
    expect(notice).toContain("34,200");
    expect(notice).toContain("24,000");
    expect(notice).toContain("6 pages");
  });

  it("gives each document the advice that applies to it", () => {
    const resume = describeTruncation({
      kind: "resume",
      kept: 24_000,
      original: 30_000,
    });
    const jd = describeTruncation({
      kind: "jobDescription",
      kept: 30_000,
      original: 40_000,
    });

    // A resume is already all content, so the only honest advice is to trim it
    // yourself. A job-description paste is usually mostly page furniture, and
    // has a one-click fix a resume does not.
    expect(resume).toContain("trim the resume yourself");
    expect(resume).not.toContain("Tidy this up");
    expect(jd).toContain("Tidy this up");
  });
});
