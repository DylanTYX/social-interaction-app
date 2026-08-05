import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmbedding, createEmbeddings } from "@/lib/embeddings";
import type { UsageCollector } from "@/lib/api/token-usage";
import {
  buildJobDescriptionTitle,
  chunkJobDescription,
} from "@/lib/jd-chunking";

export interface JobDescriptionRecord {
  id: string;
  title: string;
  roleTitle: string | null;
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
  "id, title, role_title, source_type, raw_text, created_at, updated_at";

function rowToJobDescription(row: JobDescriptionRow): JobDescriptionRecord {
  return {
    id: row.id,
    title: row.title,
    roleTitle: row.role_title,
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
    rawText,
  });

  const { data: jd, error: jdError } = await input.supabase
    .from("job_descriptions")
    .insert({
      user_id: input.userId,
      title,
      role_title: input.roleTitle?.trim() || null,
      raw_text: rawText,
      source_type: "text",
    })
    .select(JOB_DESCRIPTION_COLUMNS)
    .single();

  if (jdError) throw jdError;

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

  return rowToJobDescription(jd as JobDescriptionRow);
}

export async function listJobDescriptions(
  supabase: SupabaseClient,
  options: { limit?: number } = {},
): Promise<JobDescriptionRecord[]> {
  const { limit = 20 } = options;
  const { data, error } = await supabase
    .from("job_descriptions")
    .select(JOB_DESCRIPTION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) =>
    rowToJobDescription(row as JobDescriptionRow),
  );
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
  const { error } = await supabase.from("job_descriptions").delete().eq("id", id);
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
