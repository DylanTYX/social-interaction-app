import { parseUuid } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import {
  createSession,
  getSession,
  listTurnAnalyses,
  listSessionsInLoop,
} from "@/lib/db/sessions";
import { listPersonas } from "@/lib/db/personas";
import { buildLoopBrief } from "@/lib/loop-brief";
import type { AnalysisResult } from "@/lib/response-analyzer";
import type { PersonaConfig } from "@/lib/persona-engine";
import type { SessionLaunchMeta } from "@/lib/session-launch-meta";
import {
  buildLaunchMetaFromSetup,
  readLaunchMeta,
  readLoopProgress,
} from "@/lib/session-launch-meta";
import {
  buildRoundScenarioDescription,
  buildRoundScenarioTitle,
  getCurrentRound,
  getNextRoundLoop,
  ROUND_TYPE_LABELS,
} from "@/lib/interview-rounds";
import { resolveScenarioForLaunch } from "@/lib/scenarios";
import {
  createDefaultResumeConfig,
  type InterviewSetupState,
} from "@/lib/interview-setup";
import { unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function launchMetaToSetup(
  launch: SessionLaunchMeta,
  session: {
    scenarioValue: string;
    scenarioDescription: string | null;
    personaConfig: PersonaConfig;
    personaId: string | null;
    practiceMode: "text" | "voice";
  },
): InterviewSetupState {
  return {
    scenarioValue: session.scenarioValue,
    customScenarioBrief: launch.customScenarioBrief,
    streamResponses: launch.streamResponses,
    liveCoachingEnabled: launch.liveCoachingEnabled,
    personaConfig: session.personaConfig,
    personaLibraryId: launch.personaLibraryId,
    practiceMode: session.practiceMode,
    interviewLoop: launch.interviewLoop,
    voiceConfig: launch.voiceConfig,
    jobDescription: launch.jobDescription,
    resume: launch.resume ?? createDefaultResumeConfig(),
  };
}

export async function POST(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `next-round:${user.id}`,
      RATE_LIMITS.nextRound,
    );
    if (limited) return limited;

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "session id");
    const previous = await getSession(supabase, id);
    if (!previous) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    }

    const launch = readLaunchMeta(previous);
    if (!launch?.interviewLoop.enabled) {
      return NextResponse.json(
        { error: "This session is not part of a multi-round loop." },
        { status: 400 },
      );
    }

    const nextLoop = getNextRoundLoop(launch.interviewLoop);
    if (!nextLoop) {
      return NextResponse.json(
        { error: "No more rounds remain in this loop." },
        { status: 400 },
      );
    }

    const setup = launchMetaToSetup(
      {
        ...launch,
        interviewLoop: nextLoop,
      },
      previous,
    );
    const scenario = resolveScenarioForLaunch(setup);
    const activeRound = getCurrentRound(nextLoop);

    // Hand the next interviewer a note from the rounds already run. Without it
    // each round starts cold and the loop is N strangers rather than a panel.
    const previousAnalyses = await listTurnAnalyses(supabase, previous.id);
    const previousRound = getCurrentRound(launch.interviewLoop);
    const loopBrief = buildLoopBrief([
      {
        title: previousRound.title,
        roundTypeLabel: ROUND_TYPE_LABELS[previousRound.type],
        averageScore: previous.averageScore,
        analyses: previousAnalyses.map(
          (row) => row.analysis as unknown as AnalysisResult,
        ),
      },
    ]);

    const launchMeta = {
      ...buildLaunchMetaFromSetup(setup),
      // Carry forward what earlier rounds already said, plus this round's note.
      loopBrief:
        [launch.loopBrief, loopBrief].filter(Boolean).join("\n\n") || undefined,
    };
    const completedSessionIds = Array.from(
      new Set([
        ...(readLoopProgress(previous)?.completedSessionIds ?? []),
        previous.id,
      ]),
    );
    const loopId = readLoopProgress(previous)?.loopId ?? crypto.randomUUID();

    /**
     * One next round per source session.
     *
     * Nothing marked the previous session as advanced, so a double-click — or a
     * retry after a slow response — created a second round-2 session, each with
     * its own transcript and its own report. Where `previous` carries no loop
     * progress the two do not even share a `loop_id`, because the fallback
     * above mints a fresh one per call.
     *
     * Checked by looking for a session that already lists `previous` as
     * completed, which is exactly what this handler is about to write.
     */
    const existing = (await listSessionsInLoop(supabase, loopId)).find(
      (candidate) =>
        candidate.id !== previous.id &&
        readLoopProgress(candidate)?.completedSessionIds?.includes(previous.id),
    );

    if (existing) {
      return NextResponse.json(
        { session: existing, launchMeta: readLaunchMeta(existing) },
        { status: 200 },
      );
    }

    const roundPersona = activeRound.personaLibraryId
      ? (await listPersonas(supabase, user.id)).find(
          (entry) => entry.id === activeRound.personaLibraryId,
        )?.config
      : undefined;

    const session = await createSession(supabase, user.id, {
      practiceMode: activeRound.practiceMode,
      scenarioValue: previous.scenarioValue,
      scenarioTitle: buildRoundScenarioTitle(scenario.title, nextLoop),
      scenarioDescription: buildRoundScenarioDescription(
        scenario.description,
        nextLoop,
      ),
      // A round may nominate its own interviewer; otherwise inherit. Real
      // loops put a recruiter, then engineers, then a hiring manager in front
      // of you.
      personaId: activeRound.personaLibraryId ?? previous.personaId,
      jobDescriptionId: previous.jobDescriptionId,
      resumeId: previous.resumeId,
      personaName: roundPersona?.name ?? previous.personaName,
      personaConfig: roundPersona ?? previous.personaConfig,
      // Columns, so this is one write rather than a create-then-patch.
      launchMeta,
      loopId,
      loopProgress: { loopId, loop: nextLoop, completedSessionIds },
    });

    return NextResponse.json({ session, launchMeta }, { status: 201 });
  } catch (error) {
    return handleRouteError("POST /api/sessions/[id]/next-round", error);
  }
}
