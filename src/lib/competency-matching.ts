import { createEmbeddings } from "@/lib/embeddings";
import type { UsageCollector } from "@/lib/api/token-usage";
import {
  applyCoverage,
  COMPETENCIES,
  cosineSimilarity,
  type CompetencyCoverage,
} from "@/lib/competencies";

/**
 * Competency probe embeddings.
 *
 * The taxonomy is a compile-time constant, so its embeddings are identical for
 * every user and every session — there is no reason to store them per row or
 * recompute them per turn. They are embedded once on first use and cached for
 * the life of the server process.
 *
 * Deliberately *not* a database table: 12 vectors that only change when the
 * source file changes are configuration, not data, and a table would need a
 * migration every time the wording is tuned.
 */
let cache: Promise<number[][]> | null = null;

function getCompetencyEmbeddings(usage?: UsageCollector): Promise<number[][]> {
  if (!cache) {
    // Recorded even though it is memoised: it is a real batch of 12 embeddings
    // billed once per server process, and on a serverless deploy "once per
    // process" can mean once per cold start. Leaving it unrecorded made
    // `llm_usage` under-report embedding spend by an amount nobody could see.
    cache = createEmbeddings(
      COMPETENCIES.map((c) => c.probe),
      usage,
    ).catch((error) => {
      // Do not poison the cache — a transient failure should be retryable.
      cache = null;
      throw error;
    });
  }
  return cache;
}

/**
 * Score a question against every competency and fold the result into the
 * running coverage.
 *
 * Returns the coverage unchanged on any failure. Coverage is a reporting and
 * steering nicety; it must never be able to break an interview turn.
 */
export async function updateCoverageForQuestion(
  coverage: CompetencyCoverage,
  question: string,
  usage?: UsageCollector,
): Promise<CompetencyCoverage> {
  const text = question.trim();
  if (!text) return coverage;

  try {
    const [probeVectors, [questionVector]] = await Promise.all([
      getCompetencyEmbeddings(usage),
      createEmbeddings([text], usage),
    ]);

    if (!questionVector) return coverage;

    const similarities = COMPETENCIES.map((competency, index) => ({
      id: competency.id,
      similarity: cosineSimilarity(questionVector, probeVectors[index] ?? []),
    }));

    return applyCoverage(coverage, similarities);
  } catch (error) {
    console.warn("[competency-matching] scoring failed:", error);
    return coverage;
  }
}
