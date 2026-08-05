import type { OpenAIUsage, UsageCollector } from "@/lib/api/token-usage";

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";

export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Embed a batch of strings.
 *
 * Pass a `UsageCollector` wherever the caller has one. Embeddings are billed
 * like any other model call, and competency coverage now makes one on every
 * interview turn — without this the token accounting has a hole exactly where
 * the newest feature added cost.
 */
export async function createEmbeddings(
  inputs: string[],
  usage?: UsageCollector,
): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI embedding request failed: ${response.status} ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    usage?: OpenAIUsage;
  };
  usage?.record("embedding", EMBEDDING_MODEL, data.usage);

  const embeddings = data.data?.map((item) => item.embedding ?? []) ?? [];
  if (
    embeddings.length !== inputs.length ||
    embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)
  ) {
    throw new Error("Embedding response had an unexpected shape.");
  }

  return embeddings;
}

/** Single-input convenience over {@link createEmbeddings}. */
export async function createEmbedding(
  input: string,
  usage?: UsageCollector,
): Promise<number[]> {
  const [embedding] = await createEmbeddings([input], usage);
  if (!embedding) {
    throw new Error("Embedding response had an unexpected shape.");
  }
  return embedding;
}
