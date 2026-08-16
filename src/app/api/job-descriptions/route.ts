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

const MIN_JOB_DESCRIPTION_CHARS = 80;

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams, { fallback: 20, max: 50 });

    // Search runs in Postgres. The list is capped at 50 rows, so searching in
    // the page would only ever look at the rows that happened to load.
    const jobDescriptions = await listJobDescriptions(supabase, {
      limit,
      query: searchParams.get("query")?.slice(0, 200) ?? undefined,
    });
    return NextResponse.json({ jobDescriptions });
  } catch (error) {
    return handleRouteError("GET /api/job-descriptions", error);
  }
}

interface ParsedJobDescriptionPayload {
  rawText: string;
  roleTitle: string | null;
  company: string | null;
  sourceUrl: string | null;
}

async function parsePayload(
  request: Request,
): Promise<ParsedJobDescriptionPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const { rawText, fields } = await parsePdfUpload(request, {
      textFields: ["roleTitle", "company", "sourceUrl"],
      minChars: MIN_JOB_DESCRIPTION_CHARS,
      tooLittleTextMessage:
        "Could not extract enough text from the PDF. The file may be image-only or scanned; paste the description as text instead.",
    });
    return {
      rawText,
      roleTitle: fields.roleTitle ?? null,
      company: fields.company ?? null,
      sourceUrl: fields.sourceUrl ?? null,
    };
  }

  const body = await readJsonBody<{
    rawText?: unknown;
    roleTitle?: unknown;
    company?: unknown;
    sourceUrl?: unknown;
  }>(request);

  const readText = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";

  if (!rawText) {
    throw new ClientVisibleError("Missing rawText.");
  }

  return {
    rawText,
    roleTitle: readText(body.roleTitle),
    company: readText(body.company),
    sourceUrl: readText(body.sourceUrl),
  };
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

    const { rawText, roleTitle, company, sourceUrl } =
      await parsePayload(request);

    if (rawText.length < MIN_JOB_DESCRIPTION_CHARS) {
      return badRequest(
        `Job description must contain at least ${MIN_JOB_DESCRIPTION_CHARS} characters of text.`,
      );
    }

    // Over-length pastes are shortened by `createJobDescription`, not refused.
    // Refusing capped the stored text in exactly the same place, so it
    // prevented nothing and only blocked the user — and here the fix is usually
    // one click of Tidy this up, which the notice says.

    // Chunk embedding is the single most expensive one-off in the app; record
    // it rather than leaving upload cost invisible.
    const usage = new UsageCollector();
    const jobDescription = await createJobDescription({
      supabase,
      userId: user.id,
      rawText,
      roleTitle,
      company,
      sourceUrl,
      usage,
    });
    await usage.flush(supabase);

    return NextResponse.json({ jobDescription }, { status: 201 });
  } catch (error) {
    return handleRouteError("POST /api/job-descriptions", error);
  }
}
