import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extract plain text from a PDF buffer.
 *
 * Why `unpdf`: it ships pdf.js compiled for serverless / modern runtimes
 * with no native dependencies, so it boots inside Next.js route handlers
 * without extra build configuration.
 */
export async function extractTextFromPdf(
  buffer: ArrayBuffer | Uint8Array,
): Promise<string> {
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read PDF.";
    throw new Error(`Could not parse PDF file: ${message}`);
  }

  const { text } = await extractText(pdf, { mergePages: true });

  const flat = Array.isArray(text) ? text.join("\n\n") : text;
  return flat
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
