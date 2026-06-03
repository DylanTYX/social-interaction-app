import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  createSession,
  getSession,
  updateSession,
} from "@/lib/db/sessions";
import type { PersonaConfig } from "@/lib/personaEngine";
import {
  buildLaunchMetaFromSetup,
  parseSessionMetrics,
} from "@/lib/session-launch-meta";
import {
  buildRoundScenarioDescription,
  buildRoundScenarioTitle,
  getCurrentRound,
  getNextRoundLoop,
} from "@/lib/interview-rounds";
import { resolveScenarioForLaunch } from "@/lib/scenarios";
import {
  createDefaultResumeConfig,
  type InterviewSetupState,
} from "@/lib/interview-setup";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const launchMeta = buildLaunchMetaFromSetup(setup);
    const completedSessionIds = Array.from(
      new Set([...(metrics.loop?.completedSessionIds ?? []), previous.id]),
    );
    const loopId = metrics.loop?.loopId ?? crypto.randomUUID();

    let session = await createSession(supabase, user.id, {
      practiceMode: activeRound.practiceMode,
      scenarioValue: previous.scenarioValue,
      scenarioTitle: buildRoundScenarioTitle(scenario.title, nextLoop),
      scenarioDescription: buildRoundScenarioDescription(
        scenario.description,
        nextLoop,
      ),
  personaId: previous.personaId,
  jobDescriptionId: previous.jobDescriptionId,
  resumeId: previous.resumeId,
  personaName: previous.personaName,
      personaConfig: previous.personaConfig,
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
    const message =
      error instanceof Error ? error.message : "Failed to start next round.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
