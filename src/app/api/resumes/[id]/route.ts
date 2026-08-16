import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseUuid, readOptionalString } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { deleteResume, getResume, updateResume } from "@/lib/db/resumes";
import { DocumentInUseError } from "@/lib/db/document-in-use";
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
      `resumeDoc:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    const resume = await getResume(supabase, id);
    if (!resume) {
      return notFound();
    }

    return NextResponse.json({ resume });
  } catch (error) {
    return handleRouteError("GET /api/resumes/[id]", error);
  }
}

/** Generous, but bounded — these are labels, not documents. */
const MAX_FIELD_CHARS = {
  title: 200,
  variant: 200,
  notes: 2000,
};

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `resumeDoc:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    const body = await readJsonBody<Record<string, unknown>>(request);

    /**
     * Establish the row exists and is ours before writing anything.
     *
     * RLS scopes the update to the caller either way, but PostgREST does not
     * treat a zero-row update as a failure — so without this a PATCH naming any
     * UUID would answer 200 having changed nothing, and the difference between
     * "not yours" and "saved" would be invisible to the client. It also stops
     * the response from revealing which ids exist.
     */
    const existing = await getResume(supabase, id);
    if (!existing) {
      return notFound();
    }

    const title = readOptionalString(body, "title", MAX_FIELD_CHARS.title);
    // The only field that cannot be cleared: every list and picker renders it,
    // and `title` is `not null` in the schema.
    if (title !== undefined && (title === null || title.trim().length === 0)) {
      throw new ClientVisibleError("Title cannot be empty.", 400);
    }

    /**
     * The one field that changes what a *running* interview reads.
     *
     * The title, variant and notes are library-only and never reach a prompt,
     * so editing those mid-session is harmless. The resume text is read live on
     * every turn, so replacing it underneath an unfinished interview changes
     * what the candidate is being asked about halfway through. The db layer
     * refuses that outright; this turns the refusal into a 409 carrying the
     * count, so the user knows how many interviews to finish first.
     */
    let rawText: string | undefined;
    if ("rawText" in body) {
      if (typeof body.rawText !== "string") {
        throw new ClientVisibleError("rawText must be a string.", 400);
      }
      /**
       * No upper bound here on purpose, matching the upload path: an
       * over-length resume is shortened and the user told, not refused, and
       * `updateResume` records the original length so the notice can say what
       * was dropped. `readJsonBody`'s 256 KB ceiling is the real backstop, and
       * it rejects before anything is parsed.
       */
      if (!body.rawText.trim()) {
        throw new ClientVisibleError("rawText cannot be empty.", 400);
      }
      rawText = body.rawText;
    }

    const updated = await updateResume(supabase, id, {
      ...(rawText !== undefined ? { rawText } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(body.variant !== undefined
        ? {
            variant: readOptionalString(
              body,
              "variant",
              MAX_FIELD_CHARS.variant,
            ),
          }
        : {}),
      ...(body.notes !== undefined
        ? { notes: readOptionalString(body, "notes", MAX_FIELD_CHARS.notes) }
        : {}),
    });

    if (!updated) {
      return notFound();
    }

    return NextResponse.json({ resume: updated });
  } catch (error) {
    // 409 rather than 500: the request was well-formed and the server is fine.
    // The state of the world simply says no, and the count is the actionable
    // part of that.
    if (error instanceof DocumentInUseError) {
      return NextResponse.json(
        { error: error.message, inProgress: error.inProgress },
        { status: 409 },
      );
    }
    return handleRouteError("PATCH /api/resumes/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `resumeDoc:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    await deleteResume(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("DELETE /api/resumes/[id]", error);
  }
}
