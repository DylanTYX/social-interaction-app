import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { parseLimit } from "@/lib/api/query";
import {
  createJobDescription,
  listJobDescriptions,
} from "@/lib/db/job-descriptions";
import { parsePdfUpload } from "@/lib/api/uploads";
import {
  badRequest,
  ClientVisibleError,
  handleRouteError,
  unauthorized,
} from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { UsageCollector } from "@/lib/api/token-usage";

export const runtime = "nodejs";

const MAX_JOB_DESCRIPTION_CHARS = 30_000;
const MIN_JOB_DESCRIPTION_CHARS = 80;

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams, { fallback: 20, max: 50 });

    const jobDescriptions = await listJobDescriptions(supabase, { limit });
    return NextResponse.json({ jobDescriptions });
  } catch (error) {
    return handleRouteError("GET /api/job-descriptions", error);
  }
}

interface ParsedJobDescriptionPayload {
  rawText: string;
  roleTitle: string | null;
}

async function parsePayload(
  request: Request,
): Promise<ParsedJobDescriptionPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const { rawText, fields } = await parsePdfUpload(request, {
      textFields: ["roleTitle"],
      minChars: MIN_JOB_DESCRIPTION_CHARS,
      tooLittleTextMessage:
        "Could not extract enough text from the PDF. The file may be image-only or scanned; paste the description as text instead.",
    });
    return { rawText, roleTitle: fields.roleTitle ?? null };
  }

  const body = await readJsonBody<{
    rawText?: unknown;
    roleTitle?: unknown;
  }>(request);

  const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
  const roleTitle =
    typeof body.roleTitle === "string" && body.roleTitle.trim()
      ? body.roleTitle.trim()
      : null;

  if (!rawText) {
    throw new ClientVisibleError("Missing rawText.");
  }

  return { rawText, roleTitle };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `jd-upload:${user.id}`,
      RATE_LIMITS.documentUpload,
    );
    if (limited) return limited;

    const { rawText, roleTitle } = await parsePayload(request);

    if (rawText.length < MIN_JOB_DESCRIPTION_CHARS) {
      return badRequest(
        `Job description must contain at least ${MIN_JOB_DESCRIPTION_CHARS} characters of text.`,
      );
    }

    if (rawText.length > MAX_JOB_DESCRIPTION_CHARS) {
      return badRequest(
        `Job description is too long. Keep it under ${MAX_JOB_DESCRIPTION_CHARS.toLocaleString()} characters for now.`,
      );
    }

    // Chunk embedding is the single most expensive one-off in the app; record
    // it rather than leaving upload cost invisible.
    const usage = new UsageCollector();
    const jobDescription = await createJobDescription({
      supabase,
      userId: user.id,
      rawText,
      roleTitle,
      usage,
    });
    await usage.flush(supabase, { userId: user.id });

    return NextResponse.json({ jobDescription }, { status: 201 });
  } catch (error) {
    return handleRouteError("POST /api/job-descriptions", error);
  }
}
