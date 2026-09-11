/**
 * Rolling summary helper.
 *
 * Why: the chat route used to resend up to 20 full messages on every turn.
 * Instead we keep a compact, server-maintained summary of older turns and
 * pass it alongside only the most recent few messages. That bounds prompt
 * size as the conversation grows.
 *
 * Strategy:
 *   - We keep the **last 6 messages verbatim** in the LLM prompt.
 *   - Anything older is folded into a running summary.
 *   - The summary is regenerated from scratch (cheap) every `SUMMARY_REFRESH_EVERY`
 *     turns, using gpt-4o-mini, given the existing summary + new messages.
 *
 * The summary call uses a smaller model so it's roughly an order of magnitude
 * cheaper per turn than the main reply.
 */

import { missingOpenAIKey, openAIResponseError } from "@/lib/api/openai-errors";
import type { OpenAIUsage, UsageCollector } from "@/lib/api/token-usage";
import { completionParams } from "@/lib/model-params";

const SUMMARY_MODEL = process.env.SUMMARY_MODEL ?? "gpt-4o-mini";

/**
 * Output cap for the summary.
 *
 * This was the only chat completion in the app with no `max_tokens`, and it is
 * the worst place to omit one: the summary is regenerated *from itself* and
 * injected into the volatile prompt layer on every later turn, so one long
 * generation inflates the whole rest of the session rather than costing once.
 *
 * The prompt asks for under 180 words (~240 tokens); 400 leaves headroom so the
 * cap is a backstop rather than a routine truncation point.
 */
const SUMMARY_MAX_TOKENS = 400;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export const RECENT_MESSAGES_KEPT = 6;
/**
 * Refresh cadence, in **turns** — one turn being a user message plus the
 * interviewer's reply.
 *
 * This was expressed in messages (`SUMMARY_REFRESH_EVERY = 4`) and tested with
 * `totalMessages % 4 === 0`, which silently never fired for voice sessions.
 * Voice opens with a single assistant greeting, so its message count is
 * permanently odd — 1, 3, 5, 7 — and an odd number is never divisible by 4.
 * Every voice interview therefore refreshed its summary exactly once (on the
 * `!hasExistingSummary` branch) and never again, so from turn four onward the
 * interviewer was steering off a frozen summary and re-asking covered ground.
 * Text sessions have no opening row, land on even counts, and worked — which is
 * why it went unnoticed.
 *
 * Counting in turns is parity-independent and is what the comment above always
 * claimed the behaviour was.
 */
export const SUMMARY_REFRESH_TURNS = 2;

/**
 * The same cadence in messages, for callers sizing a transcript window.
 *
 * `chat/route.ts` reads a fixed window that must cover the verbatim tail plus
 * everything that could have aged out since the last refresh — a message count,
 * not a turn count.
 */
export const SUMMARY_REFRESH_MESSAGES = SUMMARY_REFRESH_TURNS * 2;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SummaryUpdateInput {
  previousSummary: string | null;
  /** All messages in order; we will summarize everything except the tail. */
  allMessages: ConversationMessage[];
  /** Records this call's token usage when supplied. */
  usage?: UsageCollector;
}

export interface SummaryUpdateResult {
  summary: string;
  messagesSummarized: number;
}

function buildPrompt(
  previousSummary: string | null,
  olderMessages: ConversationMessage[],
): string {
  const transcript = olderMessages
    .map((msg, index) => {
      const speaker = msg.role === "user" ? "Candidate" : "Interviewer";
      return `${index + 1}. ${speaker}: ${msg.content}`;
    })
    .join("\n");

  return [
    "You are summarising an ongoing interview conversation so future turns",
    "can be generated without re-sending the full transcript.",
    "",
    "Existing summary so far:",
    previousSummary?.trim() || "(none yet)",
    "",
    "New messages to fold in:",
    transcript || "(none)",
    "",
    "Write an updated summary as 4-7 short bullet points, focusing on:",
    "- Topics already discussed",
    "- Concrete details the candidate has shared (numbers, examples, names)",
    "- Open threads the interviewer is still probing",
    "- The current emotional or strategic tone",
    "",
    "Keep it under 180 words. Do not invent facts. Output the bullet list only.",
  ].join("\n");
}

/**
 * Returns the messages that should be summarised (everything except the tail
 * we keep verbatim). When the conversation is short enough, returns null.
 */
export function selectMessagesToSummarize(
  allMessages: ConversationMessage[],
): ConversationMessage[] | null {
  if (allMessages.length <= RECENT_MESSAGES_KEPT) return null;
  return allMessages.slice(0, allMessages.length - RECENT_MESSAGES_KEPT);
}

/**
 * Pick the recent messages to send to the LLM verbatim.
 */
export function selectRecentMessages(
  allMessages: ConversationMessage[],
): ConversationMessage[] {
  if (allMessages.length <= RECENT_MESSAGES_KEPT) return allMessages;
  return allMessages.slice(-RECENT_MESSAGES_KEPT);
}

export async function updateRollingSummary(
  input: SummaryUpdateInput,
): Promise<SummaryUpdateResult | null> {
  const olderMessages = selectMessagesToSummarize(input.allMessages);
  if (!olderMessages || olderMessages.length === 0) {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw missingOpenAIKey();
  }

  const prompt = buildPrompt(input.previousSummary, olderMessages);

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You write concise, factual conversation summaries. Never invent details.",
        },
        { role: "user", content: prompt },
      ],
      ...completionParams(SUMMARY_MODEL, {
        temperature: 0.2,
        maxTokens: SUMMARY_MAX_TOKENS,
      }),
      // Only the trailing transcript changes between refreshes; the system
      // message and instructions are constant.
      prompt_cache_key: "summary",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw openAIResponseError(response.status, text, {
      model: SUMMARY_MODEL,
      call: "summary",
    });
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: OpenAIUsage;
  };
  input.usage?.record("summary", SUMMARY_MODEL, data.usage);

  // A truncated summary is uniquely damaging here, because it is not just
  // shown once — it is persisted and fed into every subsequent prompt, and the
  // next refresh builds on top of it. A half-written final bullet would compound
  // for the rest of the session. Returning null makes the caller keep the
  // previous summary, which is stale but coherent.
  if (data.choices?.[0]?.finish_reason === "length") {
    console.warn(
      `Rolling summary truncated at ${SUMMARY_MAX_TOKENS} tokens; keeping the previous summary.`,
    );
    return null;
  }

  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error("Summary generation returned an empty response.");
  }

  return {
    summary,
    messagesSummarized: olderMessages.length,
  };
}

/**
 * Heuristic: should we regenerate the rolling summary on this turn?
 * We avoid running it every turn to keep latency and cost down.
 */
export function shouldRefreshSummary(
  totalMessages: number,
  hasExistingSummary: boolean,
): boolean {
  if (totalMessages <= RECENT_MESSAGES_KEPT) return false;
  if (!hasExistingSummary) return true;

  // Messages → turns before applying the cadence. Dividing collapses the
  // parity difference between a voice session (odd message counts, because of
  // the opening greeting) and a text one (even), so both refresh on the same
  // schedule instead of one of them never refreshing at all.
  const turns = Math.floor(totalMessages / 2);
  return turns > 0 && turns % SUMMARY_REFRESH_TURNS === 0;
}
