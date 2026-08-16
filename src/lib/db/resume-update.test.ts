import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_RESUME_CHARS, updateResume } from "@/lib/db/resumes";
import { DocumentInUseError } from "@/lib/db/document-in-use";

/**
 * The rule that makes editing a CV's text safe, and the job description's twin.
 *
 * The title, variant and notes never reach a prompt, so changing them cannot
 * disturb a running interview. The text is the opposite: `formatResumeForPrompt`
 * runs per request rather than being snapshotted at launch, so replacing it
 * mid-session means the first half of an interview probes one career history
 * and the second half another, both landing on one report.
 *
 * Worth pinning because it is invisible until someone is halfway through an
 * interview, which is exactly when nobody is running the test suite.
 */

const LONG_TEXT = "Senior engineer, distributed systems. ".repeat(10);

interface Recorded {
  tables: string[];
  updates: Array<Record<string, unknown>>;
}

function fakeSupabase({ inProgress }: { inProgress: number }) {
  const recorded: Recorded = { tables: [], updates: [] };

  const client = {
    from: (table: string) => {
      recorded.tables.push(table);

      if (table === "interview_sessions") {
        const counter = {
          select: () => counter,
          eq: () => counter,
          then: (resolve: (v: { count: number; error: null }) => unknown) =>
            resolve({ count: inProgress, error: null }),
        };
        return counter;
      }

      const builder = {
        update: (payload: Record<string, unknown>) => {
          recorded.updates.push(payload);
          return builder;
        },
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data: {
            id: "cv-1",
            title: "Jane Doe · Resume",
            variant: null,
            notes: null,
            source_type: "text",
            raw_text: LONG_TEXT,
            truncated_from: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          error: null,
        }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, recorded };
}

describe("updateResume with new text", () => {
  it("refuses while an interview is still in progress", async () => {
    const { client, recorded } = fakeSupabase({ inProgress: 2 });

    await expect(
      updateResume(client, "cv-1", { rawText: LONG_TEXT }),
    ).rejects.toBeInstanceOf(DocumentInUseError);

    // The count is the actionable part — the route turns it into a 409 body so
    // the user knows how many interviews to finish first.
    await expect(
      updateResume(client, "cv-1", { rawText: LONG_TEXT }),
    ).rejects.toMatchObject({ inProgress: 2 });

    // And nothing was written. A refusal that had already replaced the text
    // would be worse than no guard at all.
    expect(recorded.updates).toEqual([]);
  });

  it("leaves metadata-only edits alone while a session is in progress", async () => {
    // Only the text is read live. Refusing to rename a CV mid-interview would
    // be a restriction with no reason behind it.
    const { client, recorded } = fakeSupabase({ inProgress: 3 });

    await updateResume(client, "cv-1", { variant: "PM version" });

    expect(recorded.updates).toEqual([{ variant: "PM version" }]);
    expect(recorded.tables).not.toContain("interview_sessions");
  });

  it("does not re-derive the title from the new text", async () => {
    // The title may have been set by hand, which is most of the point of an
    // edit dialog.
    const { client, recorded } = fakeSupabase({ inProgress: 0 });

    await updateResume(client, "cv-1", { rawText: LONG_TEXT });

    for (const payload of recorded.updates) {
      expect(payload).not.toHaveProperty("title");
    }
  });

  it("applies the same cap as the upload path, and records it", async () => {
    // An edit is a second way into the same column, so it has to enforce the
    // same ceiling — otherwise the cap is only as strong as the path the user
    // happens to take.
    const { client, recorded } = fakeSupabase({ inProgress: 0 });
    const oversize = "x".repeat(MAX_RESUME_CHARS + 5_000);

    await updateResume(client, "cv-1", { rawText: oversize });

    expect(recorded.updates[0].raw_text).toHaveLength(MAX_RESUME_CHARS);
    expect(recorded.updates[0].truncated_from).toBe(oversize.length);
  });

  it("clears truncation when the replacement text fits", async () => {
    // Otherwise a CV shortened once would keep claiming to be shortened after
    // the user trimmed it themselves and saved again.
    const { client, recorded } = fakeSupabase({ inProgress: 0 });

    await updateResume(client, "cv-1", { rawText: LONG_TEXT });

    expect(recorded.updates[0].truncated_from).toBeNull();
  });

  it("clears a field explicitly set to empty, and only that field", async () => {
    // Absent means "leave alone", empty means "clear". Collapsing the two is
    // how a dialog that edits one field blanks the rest.
    const { client, recorded } = fakeSupabase({ inProgress: 0 });

    await updateResume(client, "cv-1", { notes: "" });

    expect(recorded.updates).toEqual([{ notes: null }]);
  });
});
