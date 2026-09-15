import { describe, expect, it } from "vitest";

import { applyLoops, buildDemoDataset } from "@/eval/demo-seed";
import type { InterviewSessionSummary } from "@/hooks/use-interview-history";
import { aggregateCoverage } from "@/lib/competencies";
import {
  compareRecent,
  MIN_POINTS_FOR_TREND,
  sessionRoundType,
  summariseAnswers,
  summariseDelivery,
  type AnswerScoreRow,
} from "@/lib/progress-insights";
import {
  parseDeliverySnapshots,
  type LoopProgress,
  type SessionLaunchMeta,
} from "@/lib/session-launch-meta";
import { isScoredSession } from "@/lib/session-stats";

/**
 * The demo exists to show every part of the analytics page with something in
 * it. These run the seeded rows through the app's own readers, so a change to
 * a threshold or a parser that would quietly leave the demo showing empty
 * states, or claims the data does not support, fails here instead of on stage.
 */

function ids() {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
}

const NOW = new Date(Date.UTC(2026, 8, 15, 9, 0, 0));
const dataset = buildDemoDataset({ now: NOW, newId: ids() });
applyLoops(dataset, ids());

/** A session as the list endpoint returns it, including the analyses count. */
function summary(
  session: (typeof dataset.sessions)[number],
): InterviewSessionSummary {
  const row = session.row;
  return {
    id: session.id,
    practiceMode: row.practice_mode as "text" | "voice",
    scenarioTitle: row.scenario_title as string,
    scenarioValue: row.scenario_value as string,
    personaName: row.persona_name as string,
    status: row.status as InterviewSessionSummary["status"],
    turnCount: row.turn_count as number,
    scoredTurnCount: session.analyses.length,
    averageScore: row.average_score as number,
    durationMinutes: row.duration_minutes as number,
    startedAt: row.started_at as string,
    endedAt: row.ended_at as string | null,
    createdAt: row.created_at as string,
    metrics: row.metrics as Record<string, unknown>,
    competencyCoverage: row.competency_coverage,
    launchMeta: row.launch_meta as SessionLaunchMeta,
    personaConfig: row.persona_config as {
      strictness?: number;
      warmth?: number;
    },
  };
}

const sessions = dataset.sessions.map(summary);

describe("demo seed", () => {
  it("is repeatable", () => {
    const again = buildDemoDataset({ now: NOW, newId: ids() });
    applyLoops(again, ids());
    expect(again).toEqual(dataset);
  });

  it("numbers messages and analyses the way append_interview_turn does", () => {
    for (const session of dataset.sessions) {
      const turns = session.messages.map((message) => message.turn_index);
      expect(turns).toEqual(turns.map((_, index) => index + 1));
      expect(session.messages[0].role).toBe("assistant");
      expect(session.row.turn_count).toBe(turns.length);
      for (const analysis of session.analyses) {
        const message = session.messages.find(
          (row) => row.turn_index === analysis.turn_index,
        );
        expect(message?.role).toBe("user");
      }
    }
  });

  it("gives behavioural rounds enough sessions for a direction, and technical only a chart", () => {
    const scored = sessions.filter(isScoredSession);
    const byType = (type: string) =>
      scored
        .filter((session) => sessionRoundType(session) === type)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((session) => ({
          score: session.averageScore ?? 0,
          ...session.personaConfig,
        }));

    expect(compareRecent(byType("behavioral"))).not.toBeNull();
    const technical = byType("technical_swe");
    expect(technical.length).toBeGreaterThanOrEqual(MIN_POINTS_FOR_TREND);
    expect(compareRecent(technical)).toBeNull();
    expect(byType("screening").length).toBeGreaterThanOrEqual(
      MIN_POINTS_FOR_TREND,
    );
  });

  it("names a weakest part and what answers lacked for each practised round type", () => {
    const rows: AnswerScoreRow[] = dataset.sessions
      .flatMap((session) =>
        session.analyses.map((analysis) => ({
          createdAt: session.messages.find(
            (message) => message.turn_index === analysis.turn_index,
          )!.created_at,
          row: {
            roundType: analysis.round_type,
            star: analysis.analysis.starAnalysis,
            technical: analysis.analysis.technicalScores,
            specificity: analysis.analysis.specificityMetrics,
            quality: analysis.analysis.responseQuality,
            omitted: analysis.analysis.omittedFields,
            notes: analysis.analysis.gaps,
          },
        })),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => entry.row);

    const rounds = summariseAnswers(rows);
    const behavioural = rounds.find(
      (round) => round.roundType === "behavioral",
    );
    const technical = rounds.find(
      (round) => round.roundType === "technical_swe",
    );

    expect(behavioural?.weakest?.label).toBe("Result");
    expect(technical?.weakest?.label).toBe("Edge cases");
    expect(behavioural?.criteria.some((c) => c.change !== null)).toBe(true);
    expect(behavioural?.missing.some((item) => item.answers > 0)).toBe(true);
    expect(behavioural?.notes.length).toBeGreaterThan(0);
  });

  it("shows voice delivery improving, with enough answers to compare", () => {
    const delivery = summariseDelivery(
      sessions
        .filter((session) => session.practiceMode === "voice")
        .flatMap((session) =>
          parseDeliverySnapshots(session.metrics?.deliverySnapshots),
        ),
    );
    expect(delivery?.earlier).not.toBeNull();
    expect(delivery!.recent.fillersPer100!).toBeLessThan(
      delivery!.earlier!.fillersPer100!,
    );
    expect(delivery!.recent.wpm!).toBeLessThan(delivery!.earlier!.wpm!);
  });

  it("leaves some competencies never asked, so the gap list has content", () => {
    const history = aggregateCoverage(
      sessions.map((session) => session.competencyCoverage),
    );
    const never = history.filter((entry) => entry.sessions === 0);
    expect(never.length).toBeGreaterThan(0);
    expect(never.length).toBeLessThan(history.length);
  });

  it("links the loop's rounds as next-round does", () => {
    const loop = dataset.sessions
      .filter((session) => session.loop)
      .sort((a, b) => a.loop!.index - b.loop!.index);
    expect(loop).toHaveLength(3);
    const loopIds = new Set(loop.map((session) => session.row.loop_id));
    expect(loopIds.size).toBe(1);
    loop.forEach((session, index) => {
      const progress = session.row.loop_progress as LoopProgress;
      expect(progress.completedSessionIds).toEqual(
        loop.slice(0, index).map((earlier) => earlier.id),
      );
    });
  });
});
