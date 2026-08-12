import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { UsageCollector } from "@/lib/api/token-usage";
import { parseLimit } from "@/lib/api/query";
import {
  createResume,
  listResumes,
  MAX_RESUME_CHARS,
  MIN_RESUME_CHARS,
} from "@/lib/db/resumes";
import { parsePdfUpload } from "@/lib/api/uploads";
import { badRequest, handleRouteError, unauthorized } from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams, { fallback: 20, max: 50 });

    const resumes = await listResumes(supabase, { limit });
    return NextResponse.json({ resumes });
  } catch (error) {
    return handleRouteError("GET /api/resumes", error);
  }
}

interface ParsedResumePayload {
  rawText: string;
  title: string | null;
}

async function parsePayload(request: Request): Promise<ParsedResumePayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const { rawText, fields } = await parsePdfUpload(request, {
      textFields: ["title"],
      minChars: MIN_RESUME_CHARS,
      tooLittleTextMessage:
        "Could not extract enough text from the PDF. The file may be image-only or scanned; paste your resume as text instead.",
    });
    return { rawText, title: fields.title ?? null };
  }

  const body = await readJsonBody<{
    rawText?: unknown;
    title?: unknown;
  }>(request);
  const rawText = typeof body.rawText === "string" ? body.rawText : "";
  const title = typeof body.title === "string" ? body.title : null;
  return { rawText, title };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `resume-upload:${user.id}`,
      RATE_LIMITS.documentUpload,
    );
    if (limited) return limited;

    const { rawText, title } = await parsePayload(request);

    if (rawText.trim().length < MIN_RESUME_CHARS) {
      return badRequest(
        `Resume must contain at least ${MIN_RESUME_CHARS} characters of text.`,
      );
    }
    if (rawText.length > MAX_RESUME_CHARS) {
      return badRequest(
        `Resume is too long. Keep it under ${MAX_RESUME_CHARS.toLocaleString()} characters.`,
      );
    }

    // `createResume` distils the CV into a compact profile with a model call.
    // It has always accepted a collector; this route never passed one, so the
    // profile call was missing from `llm_usage` entirely. Mirrors what
    // POST /api/job-descriptions already does for its embedding batch.
    const usage = new UsageCollector();
    const resume = await createResume({
      supabase,
      userId: user.id,
      rawText,
      title,
      usage,
    });
    await usage.flush(supabase);

    return NextResponse.json({ resume }, { status: 201 });
  } catch (error) {
    return handleRouteError("POST /api/resumes", error);
  }
}
