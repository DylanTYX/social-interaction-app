import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  createJobDescription,
  listJobDescriptions,
} from "@/lib/db/job-descriptions";
import { extractTextFromPdf } from "@/lib/pdf";

export const runtime = "nodejs";

const MAX_JOB_DESCRIPTION_CHARS = 30_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 50)
        : 20;

    const jobDescriptions = await listJobDescriptions(supabase, { limit });
    return NextResponse.json({ jobDescriptions });
  } catch (error) {
    console.error("[GET /api/job-descriptions]", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to list job descriptions.";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const form = await request.formData();
    const file = form.get("file");
    const roleTitleRaw = form.get("roleTitle");
    const roleTitle =
      typeof roleTitleRaw === "string" && roleTitleRaw.trim()
        ? roleTitleRaw.trim()
        : null;

    if (!(file instanceof Blob)) {
      throw new Error("Missing PDF file in upload payload.");
    }

    if (file.size === 0) {
      throw new Error("Uploaded file is empty.");
    }

    if (file.size > MAX_PDF_BYTES) {
      throw new Error(
        `PDF is too large. Keep uploads under ${MAX_PDF_BYTES / (1024 * 1024)} MB.`,
      );
    }

    const fileType = file.type || "";
    const fileName =
      file instanceof File && typeof file.name === "string" ? file.name : "";

    const isPdf =
      fileType === "application/pdf" ||
      /\.pdf$/i.test(fileName);

    if (!isPdf) {
      throw new Error("Only PDF uploads are supported in this version.");
    }

    const buffer = await file.arrayBuffer();
    const rawText = await extractTextFromPdf(buffer);

    if (rawText.trim().length < 80) {
      throw new Error(
        "Could not extract enough text from the PDF. The file may be image-only or scanned; paste the description as text instead.",
      );
    }

    return { rawText, roleTitle };
  }

  const body = (await request.json()) as {
    rawText?: unknown;
    roleTitle?: unknown;
  };

  const rawText =
    typeof body.rawText === "string" ? body.rawText.trim() : "";
  const roleTitle =
    typeof body.roleTitle === "string" && body.roleTitle.trim()
      ? body.roleTitle.trim()
      : null;

  if (!rawText) {
    throw new Error("Missing rawText.");
  }

  return { rawText, roleTitle };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rawText, roleTitle } = await parsePayload(request);

    if (rawText.length < 80) {
      return NextResponse.json(
        { error: "Job description must contain at least 80 characters of text." },
        { status: 400 },
      );
    }

    if (rawText.length > MAX_JOB_DESCRIPTION_CHARS) {
      return NextResponse.json(
        {
          error: `Job description is too long. Keep it under ${MAX_JOB_DESCRIPTION_CHARS.toLocaleString()} characters for now.`,
        },
        { status: 400 },
      );
    }

    const jobDescription = await createJobDescription({
      supabase,
      userId: user.id,
      rawText,
      roleTitle,
    });

    return NextResponse.json({ jobDescription }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create job description.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
