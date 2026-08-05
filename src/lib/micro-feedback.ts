import type { AnalysisResult } from "@/lib/responseAnalyzer";

export type MicroFeedbackTone = "positive" | "constructive" | "neutral";

export interface MicroFeedbackResult {
  hint: string;
  tone: MicroFeedbackTone;
}

/**
 * The one-line coaching hint shown under each user turn in text mode.
 *
 * This used to be a *separate* `gpt-4o-mini` call to `/api/analyze/micro`, made
 * on every turn — roughly a third of the LLM calls in a text session — to
 * produce a single sentence. But the analyzer has already run on the same
 * answer by then and has produced exactly the material the hint needs:
 * `strengths`, `gaps`, and a score. Deriving the hint costs nothing and cannot
 * contradict the score the user is shown, which the second opinion sometimes
 * did.
 *
 * The tone mix is deliberate: lead with a genuine strength when the answer has
 * one, and pair it with the single most useful gap. That mirrors the
 * "supportive 50/50 mix" the old prompt asked the model for, but makes it a
 * property of the code rather than a hope.
 */
export function deriveMicroFeedback(
  analysis: AnalysisResult,
): MicroFeedbackResult {
  const strength = firstUseful(analysis.strengths);
  const gap = firstUseful(analysis.gaps);
  const score = Number.isFinite(analysis.overallScore)
    ? analysis.overallScore
    : 0;

  // Strong answer with nothing pressing to fix: acknowledge it and stop.
  if (score >= 75 && strength && !gap) {
    return { hint: sentence(strength), tone: "positive" };
  }

  // The common case — name what worked, then the one thing to change.
  if (strength && gap) {
    return {
      hint: sentence(`${strength} — next, ${lowerFirst(gap)}`),
      tone: score >= 65 ? "positive" : "constructive",
    };
  }

  if (gap) {
    return { hint: sentence(gap), tone: "constructive" };
  }

  if (strength) {
    return { hint: sentence(strength), tone: "positive" };
  }

  return {
    hint: "Keep going — add one concrete example next.",
    tone: "neutral",
  };
}

/** First non-empty entry, trimmed. The analyzer sometimes emits blanks. */
function firstUseful(items: string[] | undefined): string | null {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return null;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Cap at roughly one line and terminate it, matching the old 140-char brief. */
function sentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const clipped =
    clean.length > 140 ? `${clean.slice(0, 137).trimEnd()}…` : clean;
  return /[.!?…]$/.test(clipped) ? clipped : `${clipped}.`;
}
