import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  updateJobDescription,
} from "@/lib/db/job-descriptions";
import { DocumentInUseError } from "@/lib/db/document-in-use";

/**
 * The rule that makes editing a job description's text safe.
 *
 * Metadata is snapshotted into `launch_meta` at launch, so changing it later
 * cannot disturb a running interview. The chunks are read live on every turn,
 * so re-embedding them mid-session would ground the first half of an interview
 * on one document and the second half on another, both landing on one report —
 * the same defect already fixed once for *deleted* job descriptions, except an
 * edit produces no event anyone could detect.
 *
 * So the refusal is the behaviour, and it is worth pinning: it is invisible
 * until someone is halfway through an interview, which is exactly when nobody
 * is running the test suite.
 */

vi.mock("@/lib/embeddings", () => ({
  createEmbedding: vi.fn(),
  // One vector per chunk; the values are irrelevant, the count is not.
  createEmbeddings: vi.fn(async (contents: string[]) =>
    contents.map(() => [0.1, 0.2, 0.3]),
  ),
}));

const LONG_TEXT = "A rewritten job description. ".repeat(20);

interface Recorded {
  tables: string[];
  updates: Array<Record<string, unknown>>;
  deletedFrom: string[];
  inserted: number;
}

/**
 * Routes by table, because this function touches three of them: it counts
 * `interview_sessions`, updates `job_descriptions`, and rewrites
 * `job_description_chunks`.
 */
function fakeSupabase({ inProgress }: { inProgress: number }) {
  const recorded: Recorded = {
    tables: [],
    updates: [],
    deletedFrom: [],
    inserted: 0,
  };

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
        insert: (rows: unknown[]) => {
          recorded.inserted += rows.length;
          return builder;
        },
        delete: () => {
          recorded.deletedFrom.push(table);
          return builder;
        },
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data: {
            id: "jd-1",
            title: "Data Analyst at Monzo",
            role_title: null,
            company: null,
            source_url: null,
            notes: null,
            source_type: "text",
            raw_text: LONG_TEXT,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          error: null,
        }),
        then: (resolve: (v: { error: null }) => unknown) =>
          resolve({ error: null }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, recorded };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateJobDescription with new text", () => {
  it("refuses while an interview is still in progress", async () => {
    const { client, recorded } = fakeSupabase({ inProgress: 2 });

    await expect(
      updateJobDescription(
        client,
        "jd-1",
        { rawText: LONG_TEXT },
        { userId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(DocumentInUseError);

    // The count is the actionable part — the route turns it into a 409 body so
    // the user knows how many interviews to finish first.
    await expect(
      updateJobDescription(
        client,
        "jd-1",
        { rawText: LONG_TEXT },
        { userId: "user-1" },
      ),
    ).rejects.toMatchObject({ inProgress: 2 });

    // And nothing was touched. A refusal that had already deleted the chunks
    // would be worse than no guard at all.
    expect(recorded.updates).toEqual([]);
    expect(recorded.deletedFrom).toEqual([]);
  });

  it("replaces the chunks rather than appending to them", async () => {
    // `unique(job_description_id, chunk_index)` means an append would collide
    // on the second save; the old rows have to go first.
    const { client, recorded } = fakeSupabase({ inProgress: 0 });

    await updateJobDescription(
      client,
      "jd-1",
      { rawText: LONG_TEXT },
      { userId: "user-1" },
    );

    expect(recorded.deletedFrom).toEqual(["job_description_chunks"]);
    expect(recorded.inserted).toBeGreaterThan(0);
    expect(recorded.updates[0]).toHaveProperty("raw_text");
  });

  it("does not re-derive the title from the new text", async () => {
    // The title may have been set by hand — most of the point of the edit
    // dialog — so re-deriving it would silently undo that.
    const { client, recorded } = fakeSupabase({ inProgress: 0 });

    await updateJobDescription(
      client,
      "jd-1",
      { rawText: LONG_TEXT },
      { userId: "user-1" },
    );

    for (const payload of recorded.updates) {
      expect(payload).not.toHaveProperty("title");
    }
  });

  it("leaves metadata-only edits alone while a session is in progress", async () => {
    // Only the text is read live. Refusing a company rename mid-interview would
    // be a restriction with no reason behind it.
    const { client, recorded } = fakeSupabase({ inProgress: 3 });

    await updateJobDescription(client, "jd-1", { company: "Monzo" });

    expect(recorded.updates).toEqual([{ company: "Monzo" }]);
    expect(recorded.tables).not.toContain("interview_sessions");
  });
});
