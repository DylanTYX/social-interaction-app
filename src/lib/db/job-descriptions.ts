import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmbedding, createEmbeddings } from "@/lib/embeddings";
import type { UsageCollector } from "@/lib/api/token-usage";
import {
  buildJobDescriptionTitle,
  chunkJobDescription,
} from "@/lib/jd-chunking";
import { countSessionsForJobDescription } from "@/lib/db/sessions";

export interface JobDescriptionRecord {
  id: string;
  title: string;
  roleTitle: string | null;
  /** Employer, so two postings for the same role are tellable apart. */
  company: string | null;
  /** Where the posting lives, for going back to it later. */
  sourceUrl: string | null;
  notes: string | null;
  sourceType: "text";
  rawText: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetrievedJobDescriptionChunk {
  id: string;
  jobDescriptionId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
}

interface JobDescriptionRow {
  id: string;
  title: string;
  role_title: string | null;
  company: string | null;
  source_url: string | null;
  notes: string | null;
  source_type: "text";
  raw_text: string;
  created_at: string;
  updated_at: string;
}

interface MatchRow {
  id: string;
  job_description_id: string;
  content: string;
  chunk_index: number;
  similarity: number;
}

const JOB_DESCRIPTION_COLUMNS =
  "id, title, role_title, company, source_url, notes, source_type, raw_text, created_at, updated_at";

function rowToJobDescription(row: JobDescriptionRow): JobDescriptionRecord {
  return {
    id: row.id,
    title: row.title,
    roleTitle: row.role_title,
    company: row.company,
    sourceUrl: row.source_url,
    notes: row.notes,
    sourceType: row.source_type,
    rawText: row.raw_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createJobDescription(input: {
  supabase: SupabaseClient;
  userId: string;
  rawText: string;
  roleTitle?: string | null;
  company?: string | null;
  sourceUrl?: string | null;
  usage?: UsageCollector;
}): Promise<JobDescriptionRecord> {
  const rawText = input.rawText.trim();
  if (rawText.length < 80) {
    throw new Error("Job description must be at least 80 characters.");
  }

  const chunks = chunkJobDescription(rawText);
  if (chunks.length === 0) {
    throw new Error("Unable to extract usable text from the job description.");
  }

  const title = buildJobDescriptionTitle({
    roleTitle: input.roleTitle,
    company: input.company,
    rawText,
  });

  const { data: jd, error: jdError } = await input.supabase
    .from("job_descriptions")
    .insert({
      user_id: input.userId,
      title,
      role_title: input.roleTitle?.trim() || null,
      company: input.company?.trim() || null,
      source_url: input.sourceUrl?.trim() || null,
      raw_text: rawText,
      source_type: "text",
    })
    .select(JOB_DESCRIPTION_COLUMNS)
    .single();

  if (jdError) throw jdError;

  // Three writes with no transaction available through PostgREST, so the parent
  // row can outlive a failure in the two steps after it. That mattered more
  // than it looks: a JD row with zero chunks is not obviously broken anywhere.
  // The route 500s, so the user believes the upload failed — but the row
  // persists, appears in the library and in the setup wizard's picker, and any
  // interview that selects it runs with **no job-description context at all**.
  // `loadJobDescriptionContext` sees `chunkCount === 0` and returns null, which
  // is indistinguishable from "no JD attached". No error, no log, no signal
  // that the document the user carefully uploaded is inert.
  //
  // Compensating delete instead: if we cannot finish, leave nothing behind, so
  // the 500 the user sees is the truth.
  try {
    const embeddings = await createEmbeddings(
      chunks.map((chunk) => chunk.content),
      input.usage,
    );
    const chunkRows = chunks.map((chunk, index) => ({
      user_id: input.userId,
      job_description_id: jd.id,
      chunk_index: index,
      content: chunk.content,
      token_estimate: chunk.tokenEstimate,
      embedding: embeddings[index],
    }));

    const { error: chunksError } = await input.supabase
      .from("job_description_chunks")
      .insert(chunkRows);

    if (chunksError) throw chunksError;
  } catch (error) {
    // Best-effort: if the cleanup itself fails there is nothing further to try,
    // and the original error is the one worth surfacing.
    await input.supabase.from("job_descriptions").delete().eq("id", jd.id);
    throw error;
  }

  return rowToJobDescription(jd as JobDescriptionRow);
}

export async function listJobDescriptions(
  supabase: SupabaseClient,
  options: { limit?: number; query?: string } = {},
): Promise<JobDescriptionRecord[]> {
  const { limit = 20, query } = options;
  let request = supabase
    .from("job_descriptions")
    .select(JOB_DESCRIPTION_COLUMNS)
    .order("created_at", { ascending: false });

  // Search runs in Postgres rather than in the page: the library is capped at
  // 50 rows, so a client-side search would only ever look at the rows that
  // happened to load. The company filter is the opposite case and stays on the
  // client — its dropdown is built from the loaded rows, so it is complete by
  // construction. See the library page.
  const trimmed = query?.trim();
  if (trimmed) {
    // `%`, `,` and parens would otherwise break out of the `or` filter's own
    // syntax — same escaping, and same reason, as the sessions list.
    const safe = trimmed.replace(/[%,()]/g, " ");
    request = request.or(
      `title.ilike.%${safe}%,role_title.ilike.%${safe}%,company.ilike.%${safe}%`,
    );
  }

  const { data, error } = await request.limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) =>
    rowToJobDescription(row as JobDescriptionRow),
  );
}

/**
 * Thrown when a text edit would pull the ground out from under a live session.
 *
 * Its own type so the route can answer 409 with the count rather than a generic
 * 500 — the user needs to know *why* it refused, and how many interviews they
 * would have to finish or abandon first.
 */
export class JobDescriptionInUseError extends Error {
  constructor(readonly inProgress: number) {
    super(
      inProgress === 1
        ? "1 interview is still in progress with this job description."
        : `${inProgress} interviews are still in progress with this job description.`,
    );
    this.name = "JobDescriptionInUseError";
  }
}

/**
 * Rewrite a JD's chunks from new text.
 *
 * Split out because it is the dangerous half. `unique(job_description_id,
 * chunk_index)` rules out writing the new set alongside the old, and PostgREST
 * offers no transaction, so there is a window between the delete and the insert
 * where the JD has no chunks at all — a state `loadJobDescriptionContext`
 * reports as "no job context", indistinguishable from never having had one.
 *
 * `createJobDescription` guards its version of this by deleting the JD if the
 * chunk write fails. That is not available here: sessions reference this row,
 * and destroying it would be far worse than leaving it chunkless.
 *
 * Two things make the window acceptable. The caller refuses the edit outright
 * while any session is in progress, so nothing is reading these chunks. And the
 * embedding call — the slow, fallible, expensive step — runs *before* the
 * delete, so the overwhelmingly likely failure happens while the old chunks are
 * still intact.
 */
async function replaceJobDescriptionChunks(input: {
  supabase: SupabaseClient;
  userId: string;
  jobDescriptionId: string;
  rawText: string;
  usage?: UsageCollector;
}): Promise<void> {
  const chunks = chunkJobDescription(input.rawText);
  if (chunks.length === 0) {
    throw new Error("Unable to extract usable text from the job description.");
  }

  // Before the delete, deliberately. See above.
  const embeddings = await createEmbeddings(
    chunks.map((chunk) => chunk.content),
    input.usage,
  );

  const { error: deleteError } = await input.supabase
    .from("job_description_chunks")
    .delete()
    .eq("job_description_id", input.jobDescriptionId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await input.supabase
    .from("job_description_chunks")
    .insert(
      chunks.map((chunk, index) => ({
        user_id: input.userId,
        job_description_id: input.jobDescriptionId,
        chunk_index: index,
        content: chunk.content,
        token_estimate: chunk.tokenEstimate,
        embedding: embeddings[index],
      })),
    );

  // Says what actually happened. The row is now chunkless, and a caller that
  // reported a generic failure would leave the user with a job description that
  // silently contributes nothing to their next interview.
  if (insertError) {
    throw new Error(
      "The job description text was saved but its search index could not be rebuilt. Edit and save it again to restore it.",
    );
  }
}

/**
 * Edit a JD's metadata, and optionally its text.
 *
 * The text is the one field a *running* session reads live — company and title
 * are snapshotted into `launch_meta` at launch, the chunks are queried on every
 * turn. So re-embedding underneath an unfinished interview would ground its
 * first turns on one document and its last on another, both landing on one
 * report. That is the defect already fixed once for deleted job descriptions,
 * and it is why `rawText` here is refused outright while any session using this
 * job description is in progress, rather than merely warned about.
 *
 * An explicitly-passed empty string clears a field; an omitted key leaves it
 * alone. That distinction is why the payload is built key by key rather than
 * spread — `{ company: undefined }` in a PostgREST update is a write of null,
 * not a no-op.
 */
export async function updateJobDescription(
  supabase: SupabaseClient,
  id: string,
  patch: {
    title?: string;
    roleTitle?: string | null;
    company?: string | null;
    sourceUrl?: string | null;
    notes?: string | null;
    /** Requires `userId`, and refused while an interview is mid-way. */
    rawText?: string;
  },
  options: { userId?: string; usage?: UsageCollector } = {},
): Promise<JobDescriptionRecord | null> {
  if (patch.rawText !== undefined) {
    const rawText = patch.rawText.trim();
    if (rawText.length < 80) {
      throw new Error("Job description must be at least 80 characters.");
    }
    if (!options.userId) {
      throw new Error("A user is required to re-index a job description.");
    }

    const inProgress = await countSessionsForJobDescription(supabase, id, {
      status: "in_progress",
    });
    if (inProgress > 0) throw new JobDescriptionInUseError(inProgress);

    // The text lands first: if the re-index fails, the library shows what the
    // user typed and the error tells them to save again, which is recoverable.
    // The reverse order would show them the old text and hide the fact that the
    // index no longer matches it.
    const { error } = await supabase
      .from("job_descriptions")
      .update({ raw_text: rawText })
      .eq("id", id);
    if (error) throw error;

    await replaceJobDescriptionChunks({
      supabase,
      userId: options.userId,
      jobDescriptionId: id,
      rawText,
      usage: options.usage,
    });
  }
  const payload: Record<string, string | null> = {};
  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.roleTitle !== undefined)
    payload.role_title = patch.roleTitle?.trim() || null;
  if (patch.company !== undefined)
    payload.company = patch.company?.trim() || null;
  if (patch.sourceUrl !== undefined)
    payload.source_url = patch.sourceUrl?.trim() || null;
  if (patch.notes !== undefined) payload.notes = patch.notes?.trim() || null;

  /**
   * The title is deliberately not re-derived from new text. It may have been
   * set by hand — that is most of the point of the edit dialog — and silently
   * replacing it with `buildJobDescriptionTitle`'s guess would undo that.
   */
  if (Object.keys(payload).length === 0) {
    return getJobDescription(supabase, id);
  }

  const { data, error } = await supabase
    .from("job_descriptions")
    .update(payload)
    .eq("id", id)
    .select(JOB_DESCRIPTION_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToJobDescription(data as JobDescriptionRow) : null;
}

/**
 * The distinct companies in the user's library, for the filter dropdown.
 *
 * Read from the rows already fetched rather than a separate `select distinct`:
 * the library is capped at 50, so the page holds the whole set anyway and a
 * second round trip would buy nothing.
 */
export function distinctCompanies(
  items: ReadonlyArray<{ company: string | null }>,
): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const company = item.company?.trim();
    if (company) seen.add(company);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export async function getJobDescription(
  supabase: SupabaseClient,
  id: string,
): Promise<JobDescriptionRecord | null> {
  const { data, error } = await supabase
    .from("job_descriptions")
    .select(JOB_DESCRIPTION_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToJobDescription(data as JobDescriptionRow) : null;
}

export async function deleteJobDescription(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  // Cascading FK on job_description_chunks deletes chunks automatically.
  // Sessions referencing this JD have ON DELETE SET NULL, so they survive.
  const { error } = await supabase
    .from("job_descriptions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Cosine similarity below which a chunk is not worth the tokens.
 *
 * Retrieval used to return the top `matchCount` chunks unconditionally, so a
 * turn about something the JD never mentions still paid for four chunks of
 * unrelated text — and handed the interviewer irrelevant context to work from.
 */
const MIN_SIMILARITY = 0.3;

/**
 * A JD at or below this many chunks is small enough that retrieving from it is
 * pointless: the top-k *is* the whole document, so we would pay for an
 * embedding call per turn to reassemble text we could have sent once. Callers
 * detect this via `countJobDescriptionChunks` and inline instead.
 */
export const SMALL_JD_CHUNK_LIMIT = 4;

export async function countJobDescriptionChunks(
  supabase: SupabaseClient,
  jobDescriptionId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("job_description_chunks")
    .select("id", { count: "exact", head: true })
    .eq("job_description_id", jobDescriptionId);

  if (error) throw error;
  return count ?? 0;
}

/** Every chunk of a JD, in document order. Used for the small-JD inline path. */
export async function listJobDescriptionChunks(
  supabase: SupabaseClient,
  jobDescriptionId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("job_description_chunks")
    .select("content, chunk_index")
    .eq("job_description_id", jobDescriptionId)
    .order("chunk_index", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as Array<{ content: string }>).map((r) => r.content);
}

export async function retrieveJobDescriptionChunks(input: {
  supabase: SupabaseClient;
  jobDescriptionId: string;
  query: string;
  matchCount?: number;
  /** Override the relevance floor; 0 disables it. */
  minSimilarity?: number;
  usage?: UsageCollector;
}): Promise<RetrievedJobDescriptionChunk[]> {
  const query = input.query.trim();
  if (!query) return [];

  const embedding = await createEmbedding(query, input.usage);
  const { data, error } = await input.supabase.rpc(
    "match_job_description_chunks",
    {
      query_embedding: embedding,
      match_count: input.matchCount ?? 4,
      filter_job_description_id: input.jobDescriptionId,
    },
  );

  if (error) throw error;

  const floor = input.minSimilarity ?? MIN_SIMILARITY;

  const chunks = ((data ?? []) as MatchRow[]).map((row) => ({
    id: row.id,
    jobDescriptionId: row.job_description_id,
    content: row.content,
    chunkIndex: row.chunk_index,
    similarity: row.similarity,
  }));

  const relevant = chunks.filter((chunk) => chunk.similarity >= floor);

  // Keep the single best chunk when the floor removes everything. Returning
  // nothing drops role context from the prompt *and* from that turn's scoring,
  // with no signal that it happened — worse than one weak excerpt.
  return relevant.length > 0 ? relevant : chunks.slice(0, 1);
}

export function formatRetrievedJobContext(
  chunks: RetrievedJobDescriptionChunk[],
): string | null {
  if (chunks.length === 0) return null;

  return chunks
    .map((chunk, index) => {
      const confidence = Math.round(chunk.similarity * 100);
      return `Excerpt ${index + 1} (relevance ${confidence}%):\n${chunk.content}`;
    })
    .join("\n\n");
}
