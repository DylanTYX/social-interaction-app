import { jsonrepair } from "jsonrepair";

export type MicroFeedbackTone = "positive" | "constructive" | "neutral";

export interface MicroFeedbackResult {
  hint: string;
  tone: MicroFeedbackTone;
}

function parseMicroJson(raw: string): MicroFeedbackResult {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const payload = fenced?.[1]?.trim() ?? trimmed;
  const first = payload.indexOf("{");
  const last = payload.lastIndexOf("}");
  const json =
    first !== -1 && last > first
      ? payload.slice(first, last + 1)
      : payload;

  const parsed = JSON.parse(jsonrepair(json)) as {
    hint?: string;
    tone?: string;
  };

  const hint =
    typeof parsed.hint === "string" && parsed.hint.trim()
      ? parsed.hint.trim()
      : "Keep going — add one concrete example next.";

  const tone: MicroFeedbackTone =
    parsed.tone === "positive" ||
    parsed.tone === "constructive" ||
    parsed.tone === "neutral"
      ? parsed.tone
      : "neutral";

  return { hint, tone };
}

/**
 * Fast, one-sentence coaching hint shown under each user turn in text mode.
 * Uses a small model to keep latency and cost low.
 */
export async function generateMicroFeedback(
  candidateResponse: string,
  question: string,
  openaiApiKey: string,
): Promise<MicroFeedbackResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You are a concise interview coach. Reply with JSON only: {"hint":"one sentence max 140 chars","tone":"positive"|"constructive"|"neutral"}. Lead with a genuine strength when the answer has one. If there is a clear gap, add one specific improvement. Aim for a supportive 50/50 mix across a session. No markdown.',
        },
        {
          role: "user",
          content: `QUESTION:\n${question}\n\nANSWER:\n${candidateResponse}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Micro-feedback failed (HTTP ${response.status}).`);
  }

  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = result.choices?.[0]?.message?.content ?? "";
  return parseMicroJson(raw);
}
