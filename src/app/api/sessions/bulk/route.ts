import { NextResponse } from "next/server";

import {
  ClientVisibleError,
  handleRouteError,
  unauthorized,
} from "@/lib/api/errors";
import { MAX_BULK_SESSIONS, MAX_SESSION_TAGS } from "@/lib/api/input-limits";
import { parseUuid } from "@/lib/api/query";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import {
  deleteSession,
  getSessionTags,
  patchSession,
} from "@/lib/db/sessions";
import { addTag, normalizeTag, removeTag } from "@/lib/session-organisation";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * One action applied to many sessions: archive, pin, tag, file or delete.
 *
 * Each session is written through the same path as a single change —
 * `patchSession` into `update_session_progress`, which re-checks ownership, or
 * `deleteSession` under RLS — so a bulk request can do nothing a series of
 * single requests could not. Sessions that fail (someone else's id, a tag list
 * already full) are counted rather than failing the batch, because the caller
 * chose them together and most of them usually succeed.
 */

const ACTIONS = [
  "archive",
  "unarchive",
  "pin",
  "unpin",
  "add_tag",
  "remove_tag",
  "move",
  "delete",
] as const;
type BulkAction = (typeof ACTIONS)[number];

/** Parallel, but not all at once: each write is its own database round trip. */
const CONCURRENCY = 10;

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ClientVisibleError("Choose at least one session.");
  }
  if (value.length > MAX_BULK_SESSIONS) {
    throw new ClientVisibleError(
      `Choose up to ${MAX_BULK_SESSIONS} sessions at a time.`,
    );
  }
  return [...new Set(value.map((id) => parseUuid(id, "session id")))];
}

async function settle(
  ids: string[],
  run: (id: string) => Promise<void>,
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(
      ids.slice(i, i + CONCURRENCY).map(run),
    );
    for (const result of results) {
      if (result.status === "fulfilled") updated += 1;
      else failed += 1;
    }
  }
  if (failed > 0) {
    console.warn(`[POST /api/sessions/bulk] ${failed} of ${ids.length} failed`);
  }
  return { updated, failed };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `sessions:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const body = await readJsonBody<{
      ids?: unknown;
      action?: unknown;
      tag?: unknown;
      folderId?: unknown;
    }>(request);

    const action = ACTIONS.find((candidate) => candidate === body.action) as
      | BulkAction
      | undefined;
    if (!action) {
      throw new ClientVisibleError("Unknown bulk action.");
    }
    const ids = parseIds(body.ids);

    switch (action) {
      case "delete":
        return NextResponse.json(
          await settle(ids, (id) => deleteSession(supabase, id)),
        );

      case "archive":
      case "unarchive": {
        const archivedAt = action === "archive" ? new Date().toISOString() : null;
        return NextResponse.json(
          await settle(ids, (id) => patchSession(supabase, id, { archivedAt })),
        );
      }

      case "pin":
      case "unpin": {
        const pinned = action === "pin";
        return NextResponse.json(
          await settle(ids, (id) => patchSession(supabase, id, { pinned })),
        );
      }

      case "move": {
        if (body.folderId === undefined) {
          throw new ClientVisibleError("Choose a folder.");
        }
        const folderId =
          body.folderId === null ? null : parseUuid(body.folderId, "folder id");
        return NextResponse.json(
          await settle(ids, (id) => patchSession(supabase, id, { folderId })),
        );
      }

      case "add_tag":
      case "remove_tag": {
        const tag = normalizeTag(body.tag);
        if (!tag) {
          throw new ClientVisibleError("Enter a tag.");
        }
        // Read-modify-write per session, because each has its own tag list.
        // Ids the caller does not own are simply absent from this map.
        const current = await getSessionTags(supabase, ids);
        return NextResponse.json(
          await settle(ids, async (id) => {
            const tags = current.get(id);
            if (!tags) throw new Error("Session not found.");
            const next =
              action === "add_tag" ? addTag(tags, tag) : removeTag(tags, tag);
            if (next.length > MAX_SESSION_TAGS) {
              throw new Error("Tag limit reached.");
            }
            const unchanged =
              next.length === tags.length &&
              next.every((value, index) => value === tags[index]);
            if (unchanged) return;
            await patchSession(supabase, id, { tags: next });
          }),
        );
      }
    }
  } catch (error) {
    return handleRouteError("POST /api/sessions/bulk", error);
  }
}
