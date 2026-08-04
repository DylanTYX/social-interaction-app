import { extractTextFromPdf } from "@/lib/pdf";
import { ClientVisibleError } from "@/lib/api/errors";

/** Shared cap for both document upload routes. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Multipart framing (boundaries, headers, other fields) adds a little on top
 * of the file itself, so the declared body length is allowed a small margin
 * over the file cap before we reject it outright.
 */
const MULTIPART_OVERHEAD_BYTES = 16 * 1024;

export interface PdfUploadPayload {
  rawText: string;
  /** Extra string fields pulled off the form, trimmed; empty values become null. */
  fields: Record<string, string | null>;
}

/**
 * Reject an oversized request *before* materializing the body.
 *
 * `request.formData()` buffers the entire upload into memory, so checking
 * `file.size` afterwards is too late — a 500 MB POST is already resident by
 * then. `Content-Length` is client-supplied and therefore only an early,
 * cheap reject; the authoritative check is still `file.size` below.
 */
export function assertDeclaredSizeWithinLimit(request: Request): void {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(declared) &&
    declared > MAX_PDF_BYTES + MULTIPART_OVERHEAD_BYTES
  ) {
    throw new ClientVisibleError(
      `Upload is too large. Keep PDFs under ${MAX_PDF_BYTES / (1024 * 1024)} MB.`,
      413,
    );
  }
}

/**
 * Parse a `multipart/form-data` PDF upload and extract its text.
 *
 * Both `/api/resumes` and `/api/job-descriptions` had a byte-identical copy of
 * this; they now share it so the size checks cannot drift apart.
 */
export async function parsePdfUpload(
  request: Request,
  options: {
    /** Names of additional text fields to read off the form. */
    textFields?: string[];
    /** Minimum extracted characters before we consider the PDF usable. */
    minChars: number;
    /** Shown when extraction yields too little text (usually a scanned PDF). */
    tooLittleTextMessage: string;
  },
): Promise<PdfUploadPayload> {
  assertDeclaredSizeWithinLimit(request);

  const form = await request.formData();
  const file = form.get("file");

  const fields: Record<string, string | null> = {};
  for (const name of options.textFields ?? []) {
    const raw = form.get(name);
    fields[name] = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }

  if (!(file instanceof Blob)) {
    throw new ClientVisibleError("Missing PDF file in upload payload.");
  }
  if (file.size === 0) {
    throw new ClientVisibleError("Uploaded file is empty.");
  }
  // Authoritative size check — `Content-Length` above is only a hint.
  if (file.size > MAX_PDF_BYTES) {
    throw new ClientVisibleError(
      `PDF is too large. Keep uploads under ${MAX_PDF_BYTES / (1024 * 1024)} MB.`,
      413,
    );
  }

  const fileName =
    file instanceof File && typeof file.name === "string" ? file.name : "";
  const isPdf =
    (file.type || "") === "application/pdf" || /\.pdf$/i.test(fileName);
  if (!isPdf) {
    throw new ClientVisibleError(
      "Only PDF uploads are supported in this version.",
    );
  }

  const buffer = await file.arrayBuffer();

  let rawText: string;
  try {
    rawText = await extractTextFromPdf(buffer);
  } catch {
    // A malformed PDF is the user's problem to fix, not a server fault.
    throw new ClientVisibleError(
      "That file could not be read as a PDF. Try re-exporting it, or paste the text instead.",
    );
  }

  if (rawText.trim().length < options.minChars) {
    throw new ClientVisibleError(options.tooLittleTextMessage);
  }

  return { rawText, fields };
}
