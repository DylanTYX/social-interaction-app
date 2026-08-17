import type { AnalysisResult } from "@/lib/response-analyzer";
import type { RoundFamily } from "@/lib/round-types";

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
  /** Which family this round belonged to. Decides whether its questions carry. */
  family: RoundFamily;
  /**
   * What this round actually asked, oldest first — see `collectAskedQuestions`.
   *
   * Required rather than optional: this is the one thing the brief exists to
   * carry that it did not before, and an optional field would let a future
   * caller drop it without noticing.
   */
  askedQuestions: string[];
}

/**
 * How many of a round's questions carry into the next round's prompt.
 *
 * Four, not ten. This lands in the *stable* prompt layer, so it is re-sent on
 * every turn of every later round — ten rounds times ten questions is a
 * transcript, not a colleague's note. Four is about what a person remembers of
 * a meeting they were not in.
 *
 * The *last* four, not the first. A round's opening question is handled by
 * `continuationOpening`, which changes the question rather than forbidding it,
 * so the openers do not need carrying; what does is the probing the round did
 * on its way through. Dropping the oldest also matches `formatAskedQuestions`,
 * so the within-round and across-round guards truncate the same way.
 */
const MAX_CARRIED_QUESTIONS = 4;

/**
 * How much of a finished round's transcript to read at handoff.
 *
 * Twelve messages is roughly six interviewer turns, which after de-duplication
 * comfortably yields four distinct questions. Matches `TRANSCRIPT_WINDOW` in
 * the chat route — the same "recent enough to matter" judgement. If it ever
 * drops below `MAX_CARRIED_QUESTIONS * 2` the cap silently stops biting.
 */
export const LOOP_BRIEF_TRANSCRIPT_WINDOW = 12;

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

/**
 * @param forFamily Which family the *upcoming* round belongs to. Questions carry
 *   only from rounds of the same family: two technical rounds can independently
 *   land on the same problem, so the second needs to know what the first asked,
 *   while a technical round's questions tell an HR interviewer nothing it can
 *   act on and would be prompt noise in a layer that is re-sent every turn.
 *   Scores, strengths and gaps carry regardless — "still unproven: quantifying
 *   impact" is worth any later interviewer knowing.
 */
export function buildLoopBrief(
  rounds: CompletedRoundSummary[],
  forFamily?: RoundFamily,
): string | null {
  const scored = rounds.filter((round) => round.analyses.length > 0);
  if (scored.length === 0) return null;

  const carried = new Map(
    scored.map((round) => [
      round,
      forFamily === undefined || round.family === forFamily
        ? round.askedQuestions.slice(-MAX_CARRIED_QUESTIONS)
        : [],
    ]),
  );
  const anyQuestions = [...carried.values()].some((list) => list.length > 0);

  const lines = [
    "Notes from this candidate's earlier rounds today, shared by your colleagues.",
    "Use them to follow up on open threads and avoid repeating ground already covered.",
    "Refer to them naturally if it helps — never read them out or mention that you have notes.",
    // Only when something was actually carried, so the brief never refers to a
    // section it did not emit. Deliberately echoes `formatAskedQuestions`, so
    // the within-round and across-round guards read as one instruction.
    ...(anyQuestions
      ? [
          'Anything under "Already asked" has been put to them today — do not ask it again, or a reworded version of it.',
        ]
      : []),
    "",
  ];

  for (const round of scored) {
    const strengths = collectTopThemes(round.analyses, "strengths");
    const gaps = collectTopThemes(round.analyses, "gaps");
    const asked = carried.get(round) ?? [];

    lines.push(
      `${round.title} (${round.roundTypeLabel})${
        round.averageScore !== null ? ` — scored ${round.averageScore}/100` : ""
      }`,
    );
    if (strengths.length)
      lines.push(`  Came across well: ${strengths.join("; ")}`);
    if (gaps.length) lines.push(`  Still unproven: ${gaps.join("; ")}`);
    // Quoted, because a question can contain the "; " that joins them.
    if (asked.length)
      lines.push(
        `  Already asked: ${asked.map((q) => `"${q}"`).join("; ")}`,
      );
  }

  return lines.join("\n");
}
