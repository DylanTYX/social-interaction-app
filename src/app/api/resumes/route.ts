import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  createResume,
  listResumes,
  MAX_RESUME_CHARS,
  MIN_RESUME_CHARS,
} from "@/lib/db/resumes";
import { extractTextFromPdf } from "@/lib/pdf";

export const runtime = "nodejs";

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

    const resumes = await listResumes(supabase, { limit });
    return NextResponse.json({ resumes });
  } catch (error) {
    console.error("[GET /api/resumes]", error);
    const message =
      error instanceof Error ? error.message : "Failed to list resumes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface ParsedResumePayload {
  rawText: string;
  title: string | null;
}

async function parsePayload(request: Request): Promise<ParsedResumePayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const titleRaw = form.get("title");
    const title =
      typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : null;

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
    const isPdf = fileType === "application/pdf" || /\.pdf$/i.test(fileName);
    if (!isPdf) {
      throw new Error("Only PDF uploads are supported in this version.");
    }

    const buffer = await file.arrayBuffer();
    const rawText = await extractTextFromPdf(buffer);
    if (rawText.trim().length < MIN_RESUME_CHARS) {
      throw new Error(
        "Could not extract enough text from the PDF. The file may be image-only or scanned; paste your resume as text instead.",
      );
    }
    return { rawText, title };
  }

  const body = (await request.json()) as {
    rawText?: unknown;
    title?: unknown;
  };
  const rawText = typeof body.rawText === "string" ? body.rawText : "";
  const title = typeof body.title === "string" ? body.title : null;
  return { rawText, title };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rawText, title } = await parsePayload(request);

    if (rawText.trim().length < MIN_RESUME_CHARS) {
      return NextResponse.json(
        {
          error: `Resume must contain at least ${MIN_RESUME_CHARS} characters of text.`,
        },
        { status: 400 },
      );
    }
    if (rawText.length > MAX_RESUME_CHARS) {
      return NextResponse.json(
        {
          error: `Resume is too long. Keep it under ${MAX_RESUME_CHARS.toLocaleString()} characters.`,
        },
        { status: 400 },
      );
    }

    const resume = await createResume({
      supabase,
      userId: user.id,
      rawText,
      title,
    });

    return NextResponse.json({ resume }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create resume.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
