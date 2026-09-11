import { NextResponse } from "next/server";

import {
  ClientVisibleError,
  handleRouteError,
  unauthorized,
} from "@/lib/api/errors";
import { MAX_FOLDER_NAME_CHARS } from "@/lib/api/input-limits";
import { parseBoundedString } from "@/lib/api/query";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import {
  createSessionFolder,
  isDuplicateFolderName,
  listSessionFolders,
} from "@/lib/db/session-folders";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
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

    return NextResponse.json({ folders: await listSessionFolders(supabase) });
  } catch (error) {
    return handleRouteError("GET /api/session-folders", error);
  }
}

export async function POST(request: Request) {
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

    const body = await readJsonBody<{ name?: unknown }>(request);
    const name = parseBoundedString(body.name, {
      field: "name",
      max: MAX_FOLDER_NAME_CHARS,
      required: true,
    }) as string;

    try {
      const folder = await createSessionFolder(supabase, user.id, name);
      return NextResponse.json({ folder });
    } catch (error) {
      // The unique index is case-insensitive, so "acme" collides with "Acme".
      if (isDuplicateFolderName(error)) {
        throw new ClientVisibleError(`You already have a folder called “${name}”.`);
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError("POST /api/session-folders", error);
  }
}
