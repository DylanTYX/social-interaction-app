import { extractText, getDocumentProxy } from "unpdf";

import { ClientVisibleError } from "@/lib/api/errors";

/**
 * Extract plain text from a PDF buffer.
 *
 * Why `unpdf`: it ships pdf.js compiled for serverless / modern runtimes
 * with no native dependencies, so it boots inside Next.js route handlers
 * without extra build configuration.
 *
 * The bounds below exist because the 10 MB upload cap bounds the *compressed*
 * file and nothing else. A small PDF can declare tens of thousands of pages, or
 * carry high-ratio Flate streams that expand to hundreds of megabytes of
 * strings — and the callers' own length checks run *after* extraction has
 * finished, which is far too late. pdf.js parsing is CPU-bound, so on a
 * `runtime = "nodejs"` handler one upload can wedge the instance for everyone.
 */

/** Refused outright above this. A resume or job spec is nowhere near it. */
export const MAX_PDF_PAGES = 100;

/**
 * Ceiling on extracted characters. Above what either caller keeps (`resumes`
 * stores 20k, `job_descriptions` 30k) so a legitimate file is never truncated
 * into a spurious "too little text" rejection.
 */
export const MAX_PDF_CHARS = 200_000;

/** Wall-clock ceiling for parsing plus extraction. */
export const PDF_TIMEOUT_MS = 20_000;

class PdfTimeoutError extends Error {}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new PdfTimeoutError("PDF processing timed out.")),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function extractTextFromPdf(
  buffer: ArrayBuffer | Uint8Array,
): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  try {
    return await withTimeout(extractBounded(bytes), PDF_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof PdfTimeoutError) {
      // "Timed out" is the actionable message, and it must not read as though
      // the file was malformed.
      throw new ClientVisibleError(
        "This PDF took too long to read. Try a smaller or simpler file.",
        413,
      );
    }
    throw error;
  }
}

async function extractBounded(bytes: Uint8Array): Promise<string> {
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read PDF.";
    throw new Error(`Could not parse PDF file: ${message}`);
  }

  // Checked before extraction, which is the whole point — `extractText` walks
  // every page, so asking it for a 20,000-page document and trimming the result
  // afterwards would have already done the damage. Refused rather than silently
  // truncated: a document this long is not the one the user meant to upload,
  // and quietly reading its first 100 pages would be worse than saying so.
  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new ClientVisibleError(
      `This PDF has ${pdf.numPages} pages. Upload a document of ${MAX_PDF_PAGES} pages or fewer.`,
      413,
    );
  }

  const { text } = await extractText(pdf, { mergePages: true });
  const flat = Array.isArray(text) ? text.join("\n\n") : text;

  return flat
    .slice(0, MAX_PDF_CHARS)
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
