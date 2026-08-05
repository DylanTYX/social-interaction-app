import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  createSession,
  getSession,
  listTurnAnalyses,
  updateSession,
} from "@/lib/db/sessions";
import { listPersonas } from "@/lib/db/personas";
import { buildLoopBrief } from "@/lib/loop-brief";
import type { AnalysisResult } from "@/lib/response-analyzer";
import type { PersonaConfig } from "@/lib/persona-engine";
import {
  buildLaunchMetaFromSetup,
  parseSessionMetrics,
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
import { serverError, unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function launchMetaToSetup(
  launch: NonNullable<ReturnType<typeof parseSessionMetrics>["launch"]>,
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

    const { id } = await ctx.params;
    const previous = await getSession(supabase, id);
    if (!previous) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const metrics = parseSessionMetrics(previous.metrics);
    const launch = metrics.launch;
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
      loopBrief: [launch.loopBrief, loopBrief].filter(Boolean).join("\n\n") || undefined,
    };
    const completedSessionIds = Array.from(
      new Set([...(metrics.loop?.completedSessionIds ?? []), previous.id]),
    );
    const loopId = metrics.loop?.loopId ?? crypto.randomUUID();

    const roundPersona = activeRound.personaLibraryId
      ? (await listPersonas(supabase, user.id)).find(
          (entry) => entry.id === activeRound.personaLibraryId,
        )?.config
      : undefined;

    let session = await createSession(supabase, user.id, {
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
      metrics: { launch: launchMeta },
    });

    session = await updateSession(supabase, session.id, {
      metrics: {
        launch: launchMeta,
        loop: {
          loopId,
          loop: nextLoop,
          completedSessionIds,
        },
      },
    });

    return NextResponse.json({ session, launchMeta }, { status: 201 });
  } catch (error) {
    return serverError("POST /api/sessions/[id]/next-round", error);
  }
}
