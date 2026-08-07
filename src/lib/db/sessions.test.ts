import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { listMessages } from "@/lib/db/sessions";

/**
 * `listMessages` ordering.
 *
 * A limited read must return the *most recent* N messages, not the first N.
 * It used to combine `ascending: true` with `.limit()`, which returns the
 * oldest rows — so `/resume` (200), `/report` (400) and `/export` (500) all
 * truncated the recent half of a long session.
 *
 * The consequence that mattered was in `recoverPersistedTurn`, which inspects
 * the last two messages to decide whether a turn landed before a stream broke.
 * Past the cap it compared messages 199 and 200, concluded the turn was never
 * written, and let the client re-POST — duplicating the answer and re-running
 * every model call for it.
 *
 * These tests assert on the *query the function builds*, because the ordering
 * decision is the bug. A fake records the calls; there is no database here.
 */

interface Recorded {
  order: Array<{ column: string; ascending: boolean }>;
  limit: number | null;
}

function fakeSupabase(rows: Array<{ turn_index: number }>) {
  const recorded: Recorded = { order: [], limit: null };

  const builder = {
    select: () => builder,
    eq: () => builder,
    order: (column: string, opts?: { ascending?: boolean }) => {
      recorded.order.push({ column, ascending: opts?.ascending !== false });
      return builder;
    },
    limit: (n: number) => {
      recorded.limit = n;
      return builder;
    },
    // Awaiting the builder resolves the query.
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      resolve({
        data: rows.map((row) => ({
          id: `m${row.turn_index}`,
          role: "user",
          content: `message ${row.turn_index}`,
          turn_index: row.turn_index,
          created_at: "2026-01-01T00:00:00Z",
        })),
        error: null,
      }),
  };

  return {
    client: { from: vi.fn(() => builder) } as unknown as SupabaseClient,
    recorded,
  };
}

describe("listMessages", () => {
  it("orders DESCENDING when a limit is given, so the limit takes the tail", async () => {
    // The bug: ascending + limit returns the OLDEST n rows.
    const { client, recorded } = fakeSupabase([{ turn_index: 9 }]);

    await listMessages(client, "s1", { limit: 12 });

    expect(recorded.order).toEqual([{ column: "turn_index", ascending: false }]);
    expect(recorded.limit).toBe(12);
  });

  it("hands the tail back oldest-first by default", async () => {
    // The database returns newest-first because of the ordering above; callers
    // that render a transcript need chronological order.
    const { client } = fakeSupabase([
      { turn_index: 9 },
      { turn_index: 8 },
      { turn_index: 7 },
    ]);

    const messages = await listMessages(client, "s1", { limit: 3 });

    expect(messages.map((m) => m.turnIndex)).toEqual([7, 8, 9]);
  });

  it("keeps newest-first when the caller explicitly asks for descending", async () => {
    const { client } = fakeSupabase([
      { turn_index: 9 },
      { turn_index: 8 },
      { turn_index: 7 },
    ]);

    const messages = await listMessages(client, "s1", {
      limit: 3,
      ascending: false,
    });

    expect(messages.map((m) => m.turnIndex)).toEqual([9, 8, 7]);
  });

  it("orders ascending and sets no limit for an unlimited read", async () => {
    // Without a limit there is no tail to take, so the natural order stands.
    const { client, recorded } = fakeSupabase([{ turn_index: 0 }]);

    await listMessages(client, "s1");

    expect(recorded.order).toEqual([{ column: "turn_index", ascending: true }]);
    expect(recorded.limit).toBeNull();
  });
});
