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

    /**
     * Establish the row exists and is ours *before* doing anything expensive.
     *
     * RLS scopes every statement below to the caller, which is why nothing here
     * could ever corrupt another user's job description — but "cannot corrupt"
     * is not the same as "declines to try". Without this check a PATCH naming
     * any UUID at all would: run a full embedding pass and bill for it, update
     * zero rows without error (PostgREST does not treat a 0-row update as a
     * failure), then attempt a chunk insert scoped to *the caller's* user_id but
     * *the supplied* job_description_id. That insert is stopped only by
     * `unique(job_description_id, chunk_index)` colliding with the victim's
     * existing chunks — so a job description that happens to be chunkless, a
     * state `replaceJobDescriptionChunks` can itself produce, would accept
     * attacker-authored chunks and serve them into the owner's next interview.
     *
     * It also stops leaking whether an id exists (404 either way now), and
     * stops arbitrary embedding spend against ids the caller has no claim to.
     */
    const existing = await getJobDescription(supabase, id);
    if (!existing) {
      return notFound();
    }

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
    let rawText: string | undefined;
    if ("rawText" in body) {
      // Held to the same standard as every other field. It used to be read as
      // `typeof body.rawText === "string" ? ... : undefined`, so `null`, a
      // number, or an empty string all fell through to "key absent" and
      // returned 200 with the text silently unchanged — while `roleTitle: 12`
      // 400s. A no-op that reports success is the worst of the three answers,
      // because the client believes the edit landed.
      if (typeof body.rawText !== "string") {
        throw new ClientVisibleError("rawText must be a string.", 400);
      }
      const parsed = parseBoundedString(body.rawText, {
        field: "rawText",
        max: MAX_JOB_DESCRIPTION_CHARS,
      });
      if (parsed === null) {
        throw new ClientVisibleError("rawText cannot be empty.", 400);
      }
      rawText = parsed;
    }

    // Costs an embedding run, so record it the way every other model call is.
    const usage = new UsageCollector();

    let updated;
    try {
      updated = await updateJobDescription(
        supabase,
        id,
        {
          ...(rawText !== undefined ? { rawText } : {}),
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
            ? {
                notes: readOptionalString(body, "notes", MAX_FIELD_CHARS.notes),
              }
            : {}),
        },
        { userId: user.id, usage },
      );
    } finally {
      // In a `finally` because the embedding call inside runs *before* both of
      // the points that can throw — the chunk delete and the chunk insert. Left
      // after the await, a failed re-index meant the tokens were billed by
      // OpenAI and recorded nowhere, which is exactly the under-reporting the
      // usage table exists to prevent.
      await usage.flush(supabase);
    }

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
