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
  }

  flushEvent();

  if (!finalResult) {
    throw new Error(
      "Streaming response ended before the final payload arrived.",
    );
  }

  return finalResult;
}
