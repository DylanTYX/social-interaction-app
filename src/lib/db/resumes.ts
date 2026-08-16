import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentInUseError } from "@/lib/db/document-in-use";
import { countSessionsForResume } from "@/lib/db/sessions";
import { MAX_RESUME_CHARS, MIN_RESUME_CHARS } from "@/lib/api/input-limits";

export { MAX_RESUME_CHARS, MIN_RESUME_CHARS };

export interface ResumeRecord {
  id: string;
  title: string;
  sourceType: "text";
  rawText: string;
  /**
   * Which version of the CV this is — "PM version", "IC/backend". The CV
   * analogue of a job description's role title, and library-only: it never
   * reaches the interviewer, it exists so two CVs are told apart in a list that
   * otherwise shows a guessed title and a date.
   */
  variant: string | null;
  /** The user's own note. Library-only, for the same reason. */
  notes: string | null;
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
  variant,
  notes,
  truncated_from,
  created_at,
  updated_at
`;

interface ResumeRow {
  id: string;
  title: string;
  source_type: "text";
  raw_text: string;
  variant: string | null;
  notes: string | null;
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
    variant: row.variant ?? null,
    notes: row.notes ?? null,
    truncatedFrom: row.truncated_from ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
  options: { limit?: number; query?: string } = {},
): Promise<ResumeRecord[]> {
  const { limit = 20, query } = options;
  let request = supabase
    .from("resumes")
    .select(RESUME_COLUMNS)
    .order("created_at", { ascending: false });

  // Search runs in Postgres rather than in the page, for the same reason as the
  // job-description list: the library is capped at 50 rows, so a client-side
  // search would only ever look at the rows that happened to load.
  const trimmed = query?.trim();
  if (trimmed) {
    // `%`, `,` and parens would otherwise break out of the `or` filter's own
    // syntax.
    const safe = trimmed.replace(/[%,()]/g, " ");
    request = request.or(`title.ilike.%${safe}%,variant.ilike.%${safe}%`);
  }

  const { data, error } = await request.limit(limit);

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

/**
 * Edit a saved CV.
 *
 * Metadata is free to change at any time: `variant`, `notes` and the title are
 * library-only and never reach a prompt, so nothing in flight can be affected
 * by them.
 *
 * `rawText` is the opposite, and is refused while any interview using this CV
 * is in progress. The interviewer reads the stored text live on every turn
 * (`formatResumeForPrompt` is called per request, not snapshotted at launch),
 * so replacing it mid-interview changes what the candidate is being asked about
 * halfway through, and the report then scores them against a document that no
 * longer exists in that form.
 *
 * Unlike the job description this is a plain column write: there are no chunks
 * to re-embed, because the whole CV is inlined rather than retrieved.
 *
 * An explicitly-passed empty string clears a field; an omitted key leaves it
 * alone. That distinction is why the payload is built key by key rather than
 * spread — `{ notes: undefined }` in a PostgREST update writes null.
 */
export async function updateResume(
  supabase: SupabaseClient,
  id: string,
  patch: {
    title?: string;
    variant?: string | null;
    notes?: string | null;
    /** Refused while an interview using this CV is mid-way. */
    rawText?: string;
  },
): Promise<ResumeRecord | null> {
  const payload: Record<string, string | number | null> = {};

  if (patch.rawText !== undefined) {
    const rawText = patch.rawText.trim();
    if (rawText.length < MIN_RESUME_CHARS) {
      throw new Error(`Resume must be at least ${MIN_RESUME_CHARS} characters.`);
    }

    const inProgress = await countSessionsForResume(supabase, id, {
      status: "in_progress",
    });
    if (inProgress > 0) throw new DocumentInUseError(inProgress, "CV");

    // The same cap and the same record of what it cost, so an edit cannot
    // sneak past a limit the upload path enforces.
    payload.raw_text = rawText.slice(0, MAX_RESUME_CHARS);
    payload.truncated_from =
      rawText.length > MAX_RESUME_CHARS ? rawText.length : null;
  }

  if (patch.title !== undefined) payload.title = patch.title.trim().slice(0, 120);
  if (patch.variant !== undefined)
    payload.variant = patch.variant?.trim() || null;
  if (patch.notes !== undefined) payload.notes = patch.notes?.trim() || null;

  /**
   * The title is deliberately not re-derived from new text. It may have been
   * set by hand — that is most of the point of an edit dialog — and replacing
   * it with `buildResumeTitle`'s guess would undo that silently.
   */
  if (Object.keys(payload).length === 0) {
    return getResume(supabase, id);
  }

  const { data, error } = await supabase
    .from("resumes")
    .update(payload)
    .eq("id", id)
    .select(RESUME_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToResume(data as ResumeRow) : null;
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
