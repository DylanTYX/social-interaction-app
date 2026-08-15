import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { countSessionsForJobDescription } from "@/lib/db/sessions";

/**
 * The query behind the "N interviews use this job description" warning.
 *
 * Asserting on the query the function builds, in the style of
 * `sessions.test.ts` — the predicate *is* the behaviour here, and getting it
 * wrong fails quietly: a missing `status` filter would count finished
 * interviews as at risk and warn about every JD the user has ever used, which
 * trains people to click through the dialog without reading it.
 *
 * Two differences from the fake in `sessions.test.ts`. It records `eq`
 * arguments, which that one discards, because the columns filtered on are the
 * thing under test. And it resolves `{ count }` rather than `{ data }`, because
 * a `head: true` count returns no rows at all.
 */

function fakeSupabase(count: number | null) {
  const recorded: {
    table: string | null;
    select: Array<{ columns: string; options?: { count?: string; head?: boolean } }>;
    eq: Array<{ column: string; value: unknown }>;
  } = { table: null, select: [], eq: [] };

  const builder = {
    select: (columns: string, options?: { count?: string; head?: boolean }) => {
      recorded.select.push({ columns, options });
      return builder;
    },
    eq: (column: string, value: unknown) => {
      recorded.eq.push({ column, value });
      return builder;
    },
    then: (resolve: (value: { count: number | null; error: null }) => unknown) =>
      resolve({ count, error: null }),
  };

  return {
    client: {
      from: vi.fn((table: string) => {
        recorded.table = table;
        return builder;
      }),
    } as unknown as SupabaseClient,
    recorded,
  };
}

describe("countSessionsForJobDescription", () => {
  it("counts without fetching rows", async () => {
    const { client, recorded } = fakeSupabase(3);

    await countSessionsForJobDescription(client, "jd-1");

    expect(recorded.table).toBe("interview_sessions");
    // `head: true` is what keeps this from pulling every matching session back
    // just to measure the array.
    expect(recorded.select[0].options).toEqual({ count: "exact", head: true });
    expect(recorded.eq).toEqual([
      { column: "job_description_id", value: "jd-1" },
    ]);
  });

  it("filters by status only when one is given", async () => {
    const { client, recorded } = fakeSupabase(1);

    await countSessionsForJobDescription(client, "jd-1", {
      status: "in_progress",
    });

    expect(recorded.eq).toEqual([
      { column: "job_description_id", value: "jd-1" },
      { column: "status", value: "in_progress" },
    ]);
  });

  it("treats a null count as zero", async () => {
    // PostgREST returns a null count when the header is absent. Returning null
    // here would render "null interviews use this job description".
    const { client } = fakeSupabase(null);
    await expect(countSessionsForJobDescription(client, "jd-1")).resolves.toBe(
      0,
    );
  });
});
