import { NextResponse } from "next/server";

import {
  ClientVisibleError,
  handleRouteError,
  notFound,
  unauthorized,
} from "@/lib/api/errors";
import { MAX_FOLDER_NAME_CHARS } from "@/lib/api/input-limits";
import { parseBoundedString, parseUuid } from "@/lib/api/query";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import {
  deleteSessionFolder,
  isDuplicateFolderName,
  renameSessionFolder,
} from "@/lib/db/session-folders";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `folders:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "folder id");
    const body = await readJsonBody<{ name?: unknown }>(request);
    const name = parseBoundedString(body.name, {
      field: "name",
      max: MAX_FOLDER_NAME_CHARS,
      required: true,
    }) as string;

    try {
      const folder = await renameSessionFolder(supabase, id, name);
      if (!folder) return notFound("Folder not found.");
      return NextResponse.json({ folder });
    } catch (error) {
      if (isDuplicateFolderName(error)) {
        throw new ClientVisibleError(`You already have a folder called “${name}”.`);
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError("PATCH /api/session-folders/[id]", error);
  }
}

/**
 * Delete a folder. Its sessions stay, unfiled — `folder_id` is
 * `on delete set null` — and, like the other deletes, a foreign or missing id
 * returns ok because RLS makes it delete nothing.
 */
export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `folders:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    await deleteSessionFolder(supabase, parseUuid(rawId, "folder id"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("DELETE /api/session-folders/[id]", error);
  }
}
