import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageCollector } from "@/lib/api/token-usage";
import { buildResumeProfile } from "@/lib/resume-profile";

export interface ResumeRecord {
  id: string;
  title: string;
  sourceType: "text";
  rawText: string;
  /**
   * Compact structured profile distilled from `rawText` once at upload time.
   * Null for resumes stored before this existed, or when the summariser failed.
   */
  profile: string | null;
  createdAt: string;
  updatedAt: string;
}

const RESUME_COLUMNS = `
  id,
  title,
  source_type,
  raw_text,
  profile,
  created_at,
  updated_at
`;

interface ResumeRow {
  id: string;
  title: string;
  source_type: "text";
  raw_text: string;
  profile: string | null;
  created_at: string;
  updated_at: string;
}

function rowToResume(row: ResumeRow): ResumeRecord {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    rawText: row.raw_text,
    profile: row.profile ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Minimum usable resume text length. */
export const MIN_RESUME_CHARS = 80;
/** Upper bound stored to keep prompts bounded. */
export const MAX_RESUME_CHARS = 20_000;
/** How much resume text we inject into a single prompt (≈ a full 2-page CV). */
const PROMPT_RESUME_CHARS = 6_000;

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
  usage?: UsageCollector;
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

  // Summarise once here so every later turn can send the compact profile
  // instead of the full text. Returns null on failure, in which case
  // `formatResumeForPrompt` falls back to the raw text — an upload must never
  // fail because the summariser did.
  const profile = await buildResumeProfile(stored, { usage: input.usage });

  const { data, error } = await input.supabase
    .from("resumes")
    .insert({
      user_id: input.userId,
      title,
      raw_text: stored,
      profile,
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
 * Format a resume for prompt injection.
 *
 * Prefers the compact `profile` distilled once at upload time. The raw text is
 * up to 6,000 characters (~1,500 tokens) and was re-sent on *every* turn; the
 * profile carries the same interview-relevant signal in roughly a fifth of
 * that. Falls back to the raw text for resumes uploaded before profiles
 * existed, or when the summariser failed.
 */
export function formatResumeForPrompt(
  resume: Pick<ResumeRecord, "rawText" | "profile"> | string | null,
): string | null {
  if (!resume) return null;

  // String form kept for callers that only hold raw text.
  if (typeof resume === "string") return clipRaw(resume);

  const profile = resume.profile?.trim();
  if (profile) return profile;

  return clipRaw(resume.rawText);
}

function clipRaw(rawText: string): string | null {
  const text = rawText.trim();
  if (!text) return null;
  return text.length > PROMPT_RESUME_CHARS
    ? `${text.slice(0, PROMPT_RESUME_CHARS)}\n…(resume truncated)`
    : text;
}
