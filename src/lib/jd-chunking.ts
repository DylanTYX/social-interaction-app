export interface JobDescriptionChunk {
  content: string;
  tokenEstimate: number;
}

const MAX_CHARS_PER_CHUNK = 1200;
const OVERLAP_CHARS = 180;
const MIN_CHARS_PER_CHUNK = 120;

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkJobDescription(rawText: string): JobDescriptionChunk[] {
  const text = normalizeText(rawText);
  if (!text) return [];

  const chunks: JobDescriptionChunk[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const hardEnd = Math.min(cursor + MAX_CHARS_PER_CHUNK, text.length);
    let end = hardEnd;

    if (hardEnd < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", hardEnd);
      const sentenceBreak = text.lastIndexOf(". ", hardEnd);
      const softBreak = Math.max(paragraphBreak, sentenceBreak);

      if (softBreak > cursor + MIN_CHARS_PER_CHUNK) {
        end = softBreak + (softBreak === sentenceBreak ? 1 : 0);
      }
    }

    const content = text.slice(cursor, end).trim();
    if (content.length >= MIN_CHARS_PER_CHUNK || chunks.length === 0) {
      chunks.push({
        content,
        tokenEstimate: estimateTokens(content),
      });
    }

    if (end >= text.length) break;
    cursor = Math.max(0, end - OVERLAP_CHARS);
  }

  return chunks;
}

export function buildJobDescriptionTitle(input: {
  roleTitle?: string | null;
  company?: string | null;
  rawText: string;
}): string {
  const roleTitle = input.roleTitle?.trim();
  const company = input.company?.trim();

  // "Data Analyst at Monzo" reads as a title; either half alone is ambiguous
  // once the library holds more than a few. The fallback below is a guess at
  // best — it takes the first line of the pasted text between 4 and 80
  // characters, which for a careers-page paste is very often "About the role"
  // — so anything the user actually told us beats it.
  if (roleTitle && company) return `${roleTitle} at ${company}`;
  if (roleTitle) return roleTitle;
  if (company) return company;

  const firstUsefulLine = normalizeText(input.rawText)
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length >= 4 && line.length <= 80);

  return firstUsefulLine ?? "Job description";
}
