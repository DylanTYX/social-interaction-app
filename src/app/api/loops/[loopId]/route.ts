import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/supabase/server";
import { listSessions, listTurnAnalyses } from "@/lib/db/sessions";
import { parseSessionMetrics } from "@/lib/session-launch-meta";
import { notFound, serverError, unauthorized } from "@/lib/api/errors";
import type { InterviewRoundType } from "@/lib/interview-rounds";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ loopId: string }>;
}

export interface LoopRoundSummary {
  sessionId: string;
  roundIndex: number;
  title: string | null;
  roundType: InterviewRoundType | null;
  practiceMode: "text" | "voice";
  status: string;
  averageScore: number | null;
  turnCount: number;
  durationMinutes: number | null;
  createdAt: string;
  /** Per-turn scores, so the client can show progression within a round. */
  turnScores: number[];
  strengths: string[];
  gaps: string[];
}

/**
 * A multi-round loop is stored as one `interview_sessions` row per round,
 * chained by `metrics.loop.loopId`. `completedSessionIds` was already being
 * tracked on every handoff and nothing ever read it, so a candidate could
 * finish a four-round loop and only ever see four unrelated single-round
 * reports.
 *
 * This aggregates them: every round in document order, with per-round scores
 * and the strengths/gaps drawn from the persisted turn analyses.
 */
export async function GET(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { loopId } = await ctx.params;

    // RLS scopes this to the caller, so a loop id belonging to someone else
    // simply matches nothing. 200 covers a generous number of rounds.
    const sessions = await listSessions(supabase, { limit: 200 });

    const inLoop = sessions
      .map((session) => ({
        session,
        metrics: parseSessionMetrics(session.metrics),
      }))
      .filter(({ metrics }) => metrics.loop?.loopId === loopId);

    if (inLoop.length === 0) {
      return notFound("Loop not found.");
    }

    // `listSessions` is newest-first; a loop reads in the order it was run.
    inLoop.reverse();

    const rounds: LoopRoundSummary[] = await Promise.all(
      inLoop.map(async ({ session, metrics }, position) => {
        const analyses = await listTurnAnalyses(supabase, session.id);
        const loopConfig = metrics.loop?.loop ?? metrics.launch?.interviewLoop;
        // Each session records which round it *is*. Using its position in this
        // list instead would shift every subsequent round's title and type as
        // soon as a round is retried and produces two sessions.
        const roundIndex = loopConfig?.currentRoundIndex ?? position;
        const round = loopConfig?.rounds?.[roundIndex];

        return {
          sessionId: session.id,
          roundIndex,
          title: round?.title ?? session.scenarioTitle,
          roundType: round?.type ?? null,
          practiceMode: session.practiceMode,
          status: session.status,
          averageScore: session.averageScore,
          turnCount: session.turnCount,
          durationMinutes: session.durationMinutes,
          createdAt: session.createdAt,
          turnScores: analyses
            .map((a) => a.overallScore)
            .filter((s): s is number => typeof s === "number"),
          strengths: collectTop(analyses, "strengths"),
          gaps: collectTop(analyses, "gaps"),
        };
      }),
    );

    const scored = rounds.filter(
      (r): r is LoopRoundSummary & { averageScore: number } =>
        typeof r.averageScore === "number",
    );

    return NextResponse.json({
      loopId,
      rounds,
      totals: {
        roundsCompleted: rounds.filter((r) => r.status === "completed").length,
        roundsTotal: rounds.length,
        averageScore: scored.length
          ? Math.round(
              scored.reduce((sum, r) => sum + r.averageScore, 0) / scored.length,
            )
          : null,
        // Improvement across the loop is the headline number: did the
        // candidate get better between the first and last scored round?
        delta:
          scored.length >= 2
            ? Math.round(
                scored[scored.length - 1].averageScore - scored[0].averageScore,
              )
            : null,
        totalTurns: rounds.reduce((sum, r) => sum + r.turnCount, 0),
        totalMinutes: rounds.reduce(
          (sum, r) => sum + (r.durationMinutes ?? 0),
          0,
        ),
      },
    });
  } catch (error) {
    return serverError("GET /api/loops/[loopId]", error);
  }
}

/**
 * Most-repeated entries across a round's analyses. A theme mentioned in three
 * answers matters more than one mentioned once, so count rather than take the
 * first.
 */
function collectTop(
  analyses: Array<{ analysis: Record<string, unknown> }>,
  key: "strengths" | "gaps",
  limit = 3,
): string[] {
  const counts = new Map<string, number>();

  for (const { analysis } of analyses) {
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
