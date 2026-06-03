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

const SUMMARY_MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export const RECENT_MESSAGES_KEPT = 6;
export const SUMMARY_REFRESH_EVERY = 4;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SummaryUpdateInput {
  previousSummary: string | null;
  /** All messages in order; we will summarize everything except the tail. */
  allMessages: ConversationMessage[];
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
    throw new Error("OPENAI_API_KEY is not configured.");
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
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Summary generation failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
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
  // After the first summary, refresh every N turns.
  return totalMessages % SUMMARY_REFRESH_EVERY === 0;
}
