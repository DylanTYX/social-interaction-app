import { describe, expect, it } from "vitest";

import { consumeChatStream } from "@/lib/chat-stream";

/**
 * When `consumeChatStream` resolves.
 *
 * The server sends `done` and *then* does the turn's bookkeeping — the rolling
 * summary (a model call, every second turn) and the competency-coverage
 * embedding. That ordering only pays off if the client stops reading at `done`;
 * the loop used to run until the body ended, so the caller waited for the
 * bookkeeping anyway.
 *
 * In voice that wait is audible: the final sentence of the reply is flushed to
 * TTS only after this promise resolves, and the microphone reopens after that.
 * A regression here is silent — everything still works, it just stutters again
 * — which is exactly why it is tested rather than eyeballed.
 */

function sseStream(frames: string[], options: { until?: Promise<void> } = {}) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index < frames.length) {
        controller.enqueue(encoder.encode(frames[index]));
        index += 1;
        return;
      }
      // Stands in for the server's post-`done` work: the body stays open until
      // `until` settles. A consumer that reads to the end of the body blocks
      // here; one that returns on `done` does not.
      await options.until;
      controller.close();
    },
  });
}

function response(stream: ReadableStream<Uint8Array>) {
  return { body: stream } as unknown as Response;
}

const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe("consumeChatStream", () => {
  it("resolves on the done event while the body is still open", async () => {
    // The load-bearing assertion. Before the fix this test would not fail — it
    // would hang, because the loop waited for a body that the server is
    // deliberately holding open while it writes the summary.
    let finishServerWork!: () => void;
    const serverStillWorking = new Promise<void>((resolve) => {
      finishServerWork = resolve;
    });

    const result = await consumeChatStream<{ aiMessage: string }>(
      response(
        sseStream(
          [
            frame("start", { status: "streaming" }),
            frame("delta", { chunk: "Hello" }),
            frame("done", { aiMessage: "Hello there." }),
          ],
          { until: serverStillWorking },
        ),
      ),
      () => {},
    );

    expect(result.aiMessage).toBe("Hello there.");

    // Let the background drain finish so it does not outlive the test.
    finishServerWork();
  });

  it("delivers every delta before resolving", async () => {
    const deltas: string[] = [];

    await consumeChatStream(
      response(
        sseStream([
          frame("delta", { chunk: "Thanks " }),
          frame("delta", { chunk: "for that." }),
          frame("done", { aiMessage: "Thanks for that." }),
        ]),
      ),
      (chunk) => deltas.push(chunk),
    );

    expect(deltas).toEqual(["Thanks ", "for that."]);
  });

  it("still throws when the body ends without a done frame", async () => {
    // The early return must not swallow a truncated stream — that is a real
    // failure and the caller has recovery logic for it.
    await expect(
      consumeChatStream(
        response(sseStream([frame("delta", { chunk: "half a rep" })])),
        () => {},
      ),
    ).rejects.toThrow(/ended before the final payload/i);
  });

  it("surfaces an in-band error frame", async () => {
    await expect(
      consumeChatStream(
        response(sseStream([frame("error", { error: "Failed to generate." })])),
        () => {},
      ),
    ).rejects.toThrow("Failed to generate.");
  });
});
