import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResumeRecord {
  id: string;
  title: string;
  sourceType: "text";
  rawText: string;
  /**
   * Original length when the upload exceeded `MAX_RESUME_CHARS`, or null when
   * it was stored whole — which is almost always. Kept so the library can go on
   * saying what was dropped long after the upload toast has gone.
   */
  truncatedFrom: number | null;
  createdAt: string;
  updatedAt: string;
}

const RESUME_COLUMNS = `
  id,
  title,
  source_type,
  raw_text,
  truncated_from,
  created_at,
  updated_at
`;

interface ResumeRow {
  id: string;
  title: string;
  source_type: "text";
  raw_text: string;
  truncated_from: number | null;
  created_at: string;
  updated_at: string;
}

function rowToResume(row: ResumeRow): ResumeRecord {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    rawText: row.raw_text,
    truncatedFrom: row.truncated_from ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Minimum usable resume text length. */
export const MIN_RESUME_CHARS = 80;
/**
 * The only ceiling on a CV, and the whole document up to it reaches the
 * interviewer.
 *
 * Six pages, at the 4,000-extracted-characters-per-page end of the estimate.
 * CVs are written to whole page counts and an industry candidate submits one to
 * three, so this is roughly three times the longest real one — a backstop
 * against a paste that is not a CV at all, not a style guide.
 *
 * There used to be a second, smaller ceiling: the prompt clipped at 6,000
 * characters, which is *inside* a normal two-page CV, so ordinary documents
 * were being cut rather than runaway ones. Two limits where the smaller one
 * silently bit is how the interviewer came to know less than the database did.
 */
export const MAX_RESUME_CHARS = 24_000;

/**
 * Derive a friendly title from the resume text — typically the candidate's
 * name on the first non-empty line, falling back to a generic label.
 */
function buildResumeTitle(rawText: string): string {
  const firstLine = rawText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (firstLine) {
    const candidate = firstLine.replace(/\s+/g, " ").slice(0, 80);
    // Avoid using an obvious section header or a giant paragraph as the title.
    if (candidate.length >= 2 && candidate.split(" ").length <= 8) {
      return `${candidate} · Resume`;
    }
  }
  return `Resume · ${new Date().toLocaleDateString()}`;
}

export async function listResumes(
  supabase: SupabaseClient,
  options: { limit?: number } = {},
): Promise<ResumeRecord[]> {
  const { limit = 20 } = options;
  const { data, error } = await supabase
    .from("resumes")
    .select(RESUME_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => rowToResume(row as ResumeRow));
}

export async function getResume(
  supabase: SupabaseClient,
  id: string,
): Promise<ResumeRecord | null> {
  const { data, error } = await supabase
    .from("resumes")
    .select(RESUME_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToResume(data as ResumeRow) : null;
}

export async function createResume(input: {
  supabase: SupabaseClient;
  userId: string;
  rawText: string;
  title?: string | null;
}): Promise<ResumeRecord> {
  const rawText = input.rawText.trim();
  if (rawText.length < MIN_RESUME_CHARS) {
    throw new Error(`Resume must be at least ${MIN_RESUME_CHARS} characters.`);
  }

  const title =
    input.title && input.title.trim()
      ? input.title.trim().slice(0, 120)
      : buildResumeTitle(rawText);

  const stored = rawText.slice(0, MAX_RESUME_CHARS);
  // Recorded rather than discarded, so the library can go on saying what was
  // dropped after the upload notice has gone. Null for the ordinary case.
  const truncatedFrom =
    rawText.length > MAX_RESUME_CHARS ? rawText.length : null;

  const { data, error } = await input.supabase
    .from("resumes")
    .insert({
      user_id: input.userId,
      title,
      raw_text: stored,
      truncated_from: truncatedFrom,
      source_type: "text",
    })
    .select(RESUME_COLUMNS)
    .single();

  if (error) throw error;
  return rowToResume(data as ResumeRow);
}

export async function deleteResume(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("resumes").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Format a resume for prompt injection: the candidate's own words, unaltered.
 *
 * This used to substitute a `profile` — a ~400-token summary written by
 * `gpt-4o-mini` at upload under a prompt whose instruction was "drop everything
 * else" — and the substitution was total, not a preference:
 *
 *     if (profile) return profile;   // early return; raw text unreachable
 *
 * So since migration 0008 the interviewer had never read a candidate's actual
 * CV. It read a paraphrase, capped at 400 tokens with no `finish_reason` check,
 * summarised from only the first 12,000 characters. Meanwhile the prompt label
 * told it this was "their actual background" and to "never invent experience
 * that isn't here" — so it could pressure-test a claim the candidate never
 * made, or refuse to explore real experience that fell outside that window, in
 * perfectly good faith.
 *
 * The purpose of a CV here is to ground questions in what the candidate has
 * actually done. A model deciding which parts of that are worth keeping defeats
 * the purpose, and it is not ours to decide: if a document must be shortened,
 * its author should choose what goes. So the whole stored document is sent, and
 * `MAX_RESUME_CHARS` — enforced once, at upload, out loud — is the only limit.
 *
 * The clip below is now unreachable in practice: nothing longer than the cap is
 * ever stored. It stays as a backstop for a row written before the cap moved.
 */
export function formatResumeForPrompt(
  resume: Pick<ResumeRecord, "rawText"> | string | null,
): string | null {
  if (!resume) return null;
  return clipRaw(typeof resume === "string" ? resume : resume.rawText);
}

function clipRaw(rawText: string): string | null {
  const text = rawText.trim();
  if (!text) return null;
  return text.length > MAX_RESUME_CHARS
    ? `${text.slice(0, MAX_RESUME_CHARS)}\n…(resume truncated)`
    : text;
}
