import { ClientVisibleError } from "@/lib/api/errors";

/**
 * Read a JSON body with a hard byte ceiling.
 *
 * Every route used to call `await request.json()` directly, and App Router
 * handlers have **no default body limit** — the well-known 4 MB cap applies to
 * Pages API routes and Server Actions, not to these. So `parseBoundedString`
 * rejecting a 10 MB `userMessage` happened only *after* Node had already parsed
 * 10 MB of JSON into a string, which is exactly the work worth avoiding.
 *
 * The sharpest case was `PATCH /api/sessions/[id]`: `metrics` is typed
 * `Record<string, unknown>`, three keys are stripped, and the remainder goes to
 * a JSONB column with no size, depth or key-count bound — then comes back on
 * every list, report, resume and export request thereafter.
 *
 * `Content-Length` is checked first because it is free, but it is only a hint:
 * a `Transfer-Encoding: chunked` request omits it entirely. The stream is
 * therefore counted as it arrives, which is the check that actually holds.
 */

/** Enough for a 10k-character answer plus delivery notes, with room to spare. */
export const MAX_JSON_BODY_BYTES = 256 * 1024;

export async function readJsonBody<T>(
  request: Request,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<T> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ClientVisibleError("Request body is too large.", 413);
  }

  const body = request.body;
  // No stream to count (some runtimes and test doubles hand back a plain
  // request). The declared-length check above is then all there is.
  if (!body) {
    return (await request.json()) as T;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      received += value.byteLength;
      if (received > maxBytes) {
        // Abandon the rest rather than draining it: unlike the SSE case, there
        // is no server-side work here worth keeping alive.
        await reader.cancel().catch(() => {});
        throw new ClientVisibleError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const text = new TextDecoder().decode(concat(chunks, received));

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ClientVisibleError("Request body is not valid JSON.");
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
