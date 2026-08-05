/**
 * Client-side speech delivery analysis. Everything here is pure and runs in the
 * browser from the transcript + per-phrase timing the Azure recognizer already
 * returns, so it adds zero API cost while giving the candidate concrete
 * delivery feedback (pace, filler words, pauses) that text mode can't surface.
 */

export interface PhraseTiming {
  text: string;
  offsetSeconds: number;
  durationSeconds: number;
}

export type PaceLabel = "slow" | "measured" | "conversational" | "fast";
export type FillerLabel = "clean" | "occasional" | "frequent";

export interface DeliveryMetrics {
  wordCount: number;
  /** Wall-clock speaking span (first phrase start → last phrase end). */
  durationSeconds: number;
  /** Words per minute over the speaking span, or null if too short to judge. */
  wpm: number | null;
  fillerCount: number;
  fillerPer100Words: number;
  fillerBreakdown: { word: string; count: number }[];
  /** Pauses longer than ~1.5s between phrases. */
  longPauseCount: number;
  paceLabel: PaceLabel | null;
  fillerLabel: FillerLabel;
}

const LONG_PAUSE_SECONDS = 1.5;

// Curated filler set. We deliberately avoid words that are usually legitimate,
// to keep counts trustworthy.
//
// "like" and "basically" used to be counted unconditionally, which
// contradicted this rule and inflated the count for ordinary sentences —
// "a linked list, like a queue". They now only count when adjacent to a real
// hesitation marker or a discourse pause, which is where they are genuinely
// filler. "actually" and "literally" are dropped entirely: they are far more
// often emphasis than hesitation.
const HESITATION_NEIGHBOUR = String.raw`(?:\b(?:um+|uh+|erm*)\b|,|\.\.\.)\s+`;

const FILLER_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "um", regex: /\b(?:um+|umm+)\b/gi },
  { label: "uh", regex: /\b(?:uh+|err+|erm+)\b/gi },
  { label: "ah", regex: /\b(?:ah+|ahh+)\b/gi },
  { label: "you know", regex: /\byou know\b/gi },
  { label: "i mean", regex: /\bi mean\b/gi },
  { label: "sort of", regex: /\bsort of\b/gi },
  { label: "kind of", regex: /\bkind of\b/gi },
  {
    label: "like",
    regex: new RegExp(String.raw`${HESITATION_NEIGHBOUR}like\b`, "gi"),
  },
  {
    label: "basically",
    regex: new RegExp(String.raw`${HESITATION_NEIGHBOUR}basically\b`, "gi"),
  },
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function paceFromWpm(wpm: number | null): PaceLabel | null {
  if (wpm === null) return null;
  if (wpm < 110) return "slow";
  if (wpm < 150) return "measured";
  if (wpm <= 185) return "conversational";
  return "fast";
}

function fillerLabelFor(per100: number): FillerLabel {
  if (per100 < 2) return "clean";
  if (per100 <= 5) return "occasional";
  return "frequent";
}

export function analyzeDelivery(
  transcript: string,
  phrases: PhraseTiming[] = [],
): DeliveryMetrics {
  const wordCount = countWords(transcript);

  const fillerBreakdown: { word: string; count: number }[] = [];
  let fillerCount = 0;
  for (const { label, regex } of FILLER_PATTERNS) {
    const matches = transcript.match(regex);
    if (matches && matches.length > 0) {
      fillerCount += matches.length;
      fillerBreakdown.push({ word: label, count: matches.length });
    }
  }
  fillerBreakdown.sort((a, b) => b.count - a.count);

  const fillerPer100Words =
    wordCount > 0 ? (fillerCount / wordCount) * 100 : 0;

  // Speaking span and pauses from per-phrase timing.
  let durationSeconds = 0;
  let longPauseCount = 0;
  const timed = phrases
    .filter((p) => Number.isFinite(p.offsetSeconds) && p.durationSeconds > 0)
    .sort((a, b) => a.offsetSeconds - b.offsetSeconds);

  if (timed.length > 0) {
    const first = timed[0];
    const last = timed[timed.length - 1];
    durationSeconds = Math.max(
      0,
      last.offsetSeconds + last.durationSeconds - first.offsetSeconds,
    );
    for (let i = 1; i < timed.length; i += 1) {
      const prevEnd = timed[i - 1].offsetSeconds + timed[i - 1].durationSeconds;
      const gap = timed[i].offsetSeconds - prevEnd;
      if (gap >= LONG_PAUSE_SECONDS) longPauseCount += 1;
    }
  }

  // Need a few words and a couple seconds before WPM is meaningful.
  const wpm =
    durationSeconds >= 2 && wordCount >= 5
      ? Math.round((wordCount / durationSeconds) * 60)
      : null;

  return {
    wordCount,
    durationSeconds: Math.round(durationSeconds * 10) / 10,
    wpm,
    fillerCount,
    fillerPer100Words: Math.round(fillerPer100Words * 10) / 10,
    fillerBreakdown,
    longPauseCount,
    paceLabel: paceFromWpm(wpm),
    fillerLabel: fillerLabelFor(fillerPer100Words),
  };
}

/** One-line human summary for display under a voice answer. */
export function describeDelivery(metrics: DeliveryMetrics): string {
  const parts: string[] = [];
  if (metrics.wpm !== null && metrics.paceLabel) {
    parts.push(`${metrics.wpm} wpm (${metrics.paceLabel})`);
  }
  if (metrics.fillerCount > 0) {
    parts.push(
      `${metrics.fillerCount} filler${metrics.fillerCount === 1 ? "" : "s"}`,
    );
  } else {
    parts.push("no fillers");
  }
  if (metrics.longPauseCount > 0) {
    parts.push(
      `${metrics.longPauseCount} long pause${
        metrics.longPauseCount === 1 ? "" : "s"
      }`,
    );
  }
  return parts.join(" · ");
}
