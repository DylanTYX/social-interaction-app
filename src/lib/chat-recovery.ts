import type { ChatTurnResponse } from "@/lib/chat-contract";

/**
 * Recover a turn whose *stream* failed, without paying for it twice.
 *
 * Both interview screens used to respond to an SSE failure by re-POSTing the
 * identical turn with `streamResponse: false`. That is unsafe in exactly the
 * situation the fallback exists for. The chat route persists the turn inside
 * the streaming task and only then emits `done`, so a transport-level failure —
 * a proxy that buffers SSE, a dropped connection, a corrupted final frame —
 * happens *after* the turn is already written. Re-posting then appends the
 * candidate's answer to the transcript a second time and re-runs all 2-4 model
 * calls for it.
 *
 * The server is the authority on whether the turn landed, so ask it. The resume
 * endpoint already exists and is already what a page reload uses.
 *
 *   - Turn landed → adopt the stored reply. No model call, no duplicate.
 *   - Turn did not land → re-POST is now provably safe.
 *
 * This deliberately does not use an idempotency key. A key would need either a
 * schema change or an in-process cache that a second server instance cannot
 * see; asking the database what it actually stored has neither problem.
 */

interface ResumeTranscript {
  messages?: Array<{ role: string; content: string }>;
  session?: { turnCount?: number; summary?: string | null };
}

/**
 * The assistant reply for this turn if the server already stored it.
 *
 * `expectedUserMessage` is matched against the last user turn so a stale or
 * unrelated transcript cannot be mistaken for this one.
 */
export async function recoverPersistedTurn(
  sessionId: string,
  expectedUserMessage: string,
): Promise<ChatTurnResponse | null> {
  try {
    const response = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/resume`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as ResumeTranscript;
    const messages = payload.messages ?? [];
    if (messages.length < 2) return null;

    const last = messages[messages.length - 1];
    const previous = messages[messages.length - 2];

    // The turn landed only if the transcript now ends with our answer followed
    // by a reply to it.
    if (last.role !== "assistant" || previous.role !== "user") return null;
    if (previous.content.trim() !== expectedUserMessage.trim()) return null;

    return {
      aiMessage: last.content,
      turnCount: payload.session?.turnCount ?? messages.length,
      summary: payload.session?.summary ?? null,
      // The inline analysis travelled in the `done` frame we never received.
      // The score itself was persisted server-side by the same transaction that
      // stored the messages, so it still reaches the report — but the client
      // cannot do this turn's bookkeeping without it.
      //
      // Two visible consequences, both accepted: no live coaching hint for this
      // one turn, and if this happened to be the *final* turn the session will
      // not auto-complete, so the candidate ends it with the button instead.
      // Both beat charging them twice and duplicating the turn.
      analysis: null,
      strategy: null,
      decisionReason: null,
      confidence: null,
      shouldEscalate: null,
      shouldSlowDown: null,
      followupSummary: null,
      microFeedback: null,
    };
  } catch {
    // Recovery is best-effort by definition — the caller falls back to a
    // normal retry, which is what it would have done anyway.
    return null;
  }
}

/**
 * The opening greeting, if the server already stored it.
 *
 * Same authority argument as above, for turn zero: the route persists the
 * assistant-only opening row *before* replying, and guards `mode: "opening"`
 * with "This interview has already started." — so a client-side failure
 * followed by a retry produces exactly that 400, an error card, and a session
 * with a greeting in the database and none on screen. The transcript is the
 * tie-breaker: exactly one assistant message means the opening landed.
 */
export async function recoverPersistedOpening(
  sessionId: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/resume`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as ResumeTranscript;
    const messages = payload.messages ?? [];
    if (messages.length !== 1) return null;
    if (messages[0].role !== "assistant") return null;
    const content = messages[0].content?.trim();
    return content || null;
  } catch {
    return null;
  }
}
