import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseBoundedString, parseUuid } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  deleteJobDescription,
  getJobDescription,
  JobDescriptionInUseError,
  updateJobDescription,
} from "@/lib/db/job-descriptions";
import { UsageCollector } from "@/lib/api/token-usage";
import { MAX_JOB_DESCRIPTION_CHARS } from "@/lib/api/input-limits";
import { readJsonBody } from "@/lib/api/read-json";
import {
  ClientVisibleError,
  notFound,
  unauthorized,
  handleRouteError,
} from "@/lib/api/errors";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `jobDescription:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    const jobDescription = await getJobDescription(supabase, id);
    if (!jobDescription) {
      return notFound();
    }

    return NextResponse.json({ jobDescription });
  } catch (error) {
    return handleRouteError("GET /api/job-descriptions/[id]", error);
  }
}

/** Generous, but bounded — these are labels, not documents. */
const MAX_FIELD_CHARS = {
  title: 200,
  roleTitle: 200,
  company: 200,
  notes: 2000,
};
const MAX_URL_CHARS = 2000;

function readOptionalString(
  body: Record<string, unknown>,
  key: string,
  maxChars: number,
): string | null | undefined {
  // Absent means "leave alone"; null or "" means "clear". They have to stay
  // distinguishable all the way down to the update payload, or a dialog that
  // only edits the title would blank every other field.
  if (!(key in body)) return undefined;
  const value = body[key];
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ClientVisibleError(`${key} must be a string.`, 400);
  }
  if (value.length > maxChars) {
    throw new ClientVisibleError(
      `${key} must be ${maxChars} characters or fewer.`,
      400,
    );
  }
  return value;
}

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `jobDescription:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    const body = await readJsonBody<Record<string, unknown>>(request);

    const title = readOptionalString(body, "title", MAX_FIELD_CHARS.title);
    // The only field that cannot be cleared: every list, picker and chip in the
    // app renders it, and `title` is `not null` in the schema.
    if (title !== undefined && (title === null || title.trim().length === 0)) {
      throw new ClientVisibleError("Title cannot be empty.", 400);
    }

    const sourceUrl = readOptionalString(body, "sourceUrl", MAX_URL_CHARS);
    if (sourceUrl) {
      // Parse rather than regex, and require http(s) explicitly — `javascript:`
      // is a URL as far as `new URL` is concerned, and this value ends up in an
      // href.
      let parsed: URL;
      try {
        parsed = new URL(sourceUrl);
      } catch {
        throw new ClientVisibleError(
          "Source URL must be a valid link starting with http:// or https://.",
          400,
        );
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ClientVisibleError(
          "Source URL must start with http:// or https://.",
          400,
        );
      }
    }

    /**
     * The one field that changes what a *running* interview reads.
     *
     * Company and title are snapshotted into `launch_meta` at launch, so
     * editing those mid-session is harmless. The chunks are queried live on
     * every turn, so re-embedding them underneath an unfinished interview would
     * ground its first turns on one document and its last on another. The db
     * layer refuses that outright; this turns the refusal into a 409 carrying
     * the count, so the user knows how many interviews to finish first.
     */
    const rawText =
      typeof body.rawText === "string"
        ? parseBoundedString(body.rawText, {
            field: "rawText",
            max: MAX_JOB_DESCRIPTION_CHARS,
          })
        : undefined;

    // Costs an embedding run, so record it the way every other model call is.
    const usage = new UsageCollector();

    const updated = await updateJobDescription(
      supabase,
      id,
      {
        ...(rawText !== undefined && rawText !== null ? { rawText } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(body.roleTitle !== undefined
          ? {
              roleTitle: readOptionalString(
                body,
                "roleTitle",
                MAX_FIELD_CHARS.roleTitle,
              ),
            }
          : {}),
        ...(body.company !== undefined
          ? {
              company: readOptionalString(
                body,
                "company",
                MAX_FIELD_CHARS.company,
              ),
            }
          : {}),
        ...(sourceUrl !== undefined ? { sourceUrl } : {}),
        ...(body.notes !== undefined
          ? { notes: readOptionalString(body, "notes", MAX_FIELD_CHARS.notes) }
          : {}),
      },
      { userId: user.id, usage },
    );

    await usage.flush(supabase);

    if (!updated) {
      return notFound();
    }

    return NextResponse.json({ jobDescription: updated });
  } catch (error) {
    // 409 rather than 500: the request was well-formed and the server is fine.
    // The state of the world simply says no, and the count is the actionable
    // part of that.
    if (error instanceof JobDescriptionInUseError) {
      return NextResponse.json(
        { error: error.message, inProgress: error.inProgress },
        { status: 409 },
      );
    }
    return handleRouteError("PATCH /api/job-descriptions/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `jobDescription:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    await deleteJobDescription(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("DELETE /api/job-descriptions/[id]", error);
  }
}
