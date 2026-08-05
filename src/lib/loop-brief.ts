import type { AnalysisResult } from "@/lib/response-analyzer";

/**
 * A short handover note from the rounds already completed.
 *
 * Each round is a separate session, so without this the interviewer in round 3
 * has no idea what happened in round 1 — it cannot follow a thread, cannot
 * avoid re-asking, and cannot say "your earlier interviewer mentioned…". In a
 * real loop the panel debriefs; here they were strangers.
 *
 * Deliberately short and second-hand in tone: it goes in the *stable* prompt
 * layer, and it should read as a colleague's note rather than a transcript the
 * interviewer somehow attended.
 */

export interface CompletedRoundSummary {
  title: string;
  roundTypeLabel: string;
  averageScore: number | null;
  analyses: Array<Pick<AnalysisResult, "strengths" | "gaps">>;
}

/** Most-repeated entries first — a theme raised three times outranks one raised once. */
export function collectTopThemes(
  analyses: Array<Pick<AnalysisResult, "strengths" | "gaps">>,
  key: "strengths" | "gaps",
  limit = 2,
): string[] {
  const counts = new Map<string, number>();

  for (const analysis of analyses) {
    const items = analysis?.[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (typeof item !== "string" || !item.trim()) continue;
      const text = item.trim();
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([text]) => text);
}

export function buildLoopBrief(rounds: CompletedRoundSummary[]): string | null {
  const scored = rounds.filter((round) => round.analyses.length > 0);
  if (scored.length === 0) return null;

  const lines = [
    "Notes from this candidate's earlier rounds today, shared by your colleagues.",
    "Use them to follow up on open threads and avoid repeating ground already covered.",
    "Refer to them naturally if it helps — never read them out or mention that you have notes.",
    "",
  ];

  for (const round of scored) {
    const strengths = collectTopThemes(round.analyses, "strengths");
    const gaps = collectTopThemes(round.analyses, "gaps");

    lines.push(
      `${round.title} (${round.roundTypeLabel})${
        round.averageScore !== null ? ` — scored ${round.averageScore}/100` : ""
      }`,
    );
    if (strengths.length) lines.push(`  Came across well: ${strengths.join("; ")}`);
    if (gaps.length) lines.push(`  Still unproven: ${gaps.join("; ")}`);
  }

  return lines.join("\n");
}
