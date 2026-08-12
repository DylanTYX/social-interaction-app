/**
 * Shared Server-Sent-Events consumer for the `/api/chat` streaming response.
 *
 * The chat route emits three event types:
 *   - `delta`: { chunk } — an incremental piece of the interviewer's reply
 *   - `done`:  the full final payload (assistant message + inline analysis)
 *   - `error`: { error | details }
 *
 * `onDelta` fires for each `delta`; the resolved value is the `done` payload.
 * Both the text and voice pages use this so streaming behaves identically.
 */

type StreamEventPayload = {
  chunk?: string;
  error?: string;
  details?: string;
};

export async function consumeChatStream<TResult>(
  response: Response,
  onDelta: (chunk: string) => void,
): Promise<TResult> {
  if (!response.body) {
    throw new Error("Streaming response did not include a body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // Set once the reader has been handed to the background drain, so the
  // failure path below knows not to touch it.
  let handedOff = false;
  let buffer = "";
  let currentEvent = "";
  let currentData = "";
  let finalResult: TResult | null = null;

  const flushEvent = () => {
    const payload = currentData.trim();

    if (!currentEvent || !payload) {
      currentEvent = "";
      currentData = "";
      return;
    }

    if (currentEvent === "delta") {
      const parsed = JSON.parse(payload) as StreamEventPayload;
      if (parsed.chunk) {
        onDelta(parsed.chunk);
      }
    } else if (currentEvent === "done") {
      finalResult = JSON.parse(payload) as TResult;
    } else if (currentEvent === "error") {
      const parsed = JSON.parse(payload) as StreamEventPayload;
      throw new Error(parsed.error ?? parsed.details ?? "Streaming failed.");
    }

    currentEvent = "";
    currentData = "";
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        if (line.startsWith("event:")) {
          flushEvent();
          currentEvent = line.slice(6).trim();
          continue;
        }

        if (line.startsWith("data:")) {
          currentData += line.slice(5).trim();
          continue;
        }

        if (line === "") {
          flushEvent();
        }
      }

      /**
       * Return the moment `done` is parsed, rather than waiting for the body.
       *
       * The server finishes the turn's bookkeeping — the rolling summary, a model
       * call on every second turn, and the competency-coverage embedding — *after*
       * it sends `done`. Reading on to the end of the body would put all of that
       * back on the caller's critical path, which in voice means the last sentence
       * of the reply stays unspoken and the microphone stays shut for it.
       */
      if (finalResult) break;
    }

    flushEvent();

    if (!finalResult) {
      throw new Error(
        "Streaming response ended before the final payload arrived.",
      );
    }

    handedOff = true;
    drainInBackground(reader);

    return finalResult;
  } finally {
    /**
     * A turn that failed has no post-`done` work worth protecting, so the
     * reader is cancelled rather than drained. Without this the in-band
     * `error` frame threw straight out of the loop with the body still locked
     * and unread — one leaked connection per server-side failure.
     */
    if (!handedOff) {
      void reader.cancel().catch(() => {});
    }
  }
}

/**
 * How long the background drain will wait for the server to close.
 *
 * The post-`done` work is a rolling-summary completion plus an embedding call —
 * a couple of seconds normally, and neither has a timeout of its own.
 */
const DRAIN_TIMEOUT_MS = 30_000;

/**
 * Read the rest of the body to completion, detached, then let go of it.
 *
 * Deliberately not `reader.cancel()` on the happy path: cancelling propagates
 * an abort upstream, which on some hosts tears down the serverless invocation —
 * killing exactly the post-`done` summary write this early return exists to get
 * off the critical path. Reading to completion lets the server close normally.
 *
 * But it cannot wait forever either. `finalize` makes two un-timed network
 * calls, so one degraded OpenAI summary endpoint used to leave this loop
 * pending, the body locked and the connection open for the life of the tab —
 * once per turn, until the browser's per-origin connection budget was gone and
 * the *next* request stalled before it was even dispatched. Past the deadline
 * the connection is worth more than the summary.
 */
function drainInBackground(reader: ReadableStreamDefaultReader<Uint8Array>) {
  void (async () => {
    const deadline = setTimeout(() => {
      void reader.cancel().catch(() => {});
    }, DRAIN_TIMEOUT_MS);

    try {
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      // The turn already succeeded; nothing here is worth surfacing.
    } finally {
      clearTimeout(deadline);
      try {
        reader.releaseLock();
      } catch {
        // Already released by `cancel()`.
      }
    }
  })();
}
