import { parseUuid } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import {
  createSession,
  getSession,
  listMessages,
  listTurnAnalyses,
  listSessionsInLoop,
} from "@/lib/db/sessions";
import { listPersonas } from "@/lib/db/personas";
import {
  buildLoopBrief,
  LOOP_BRIEF_TRANSCRIPT_WINDOW,
} from "@/lib/loop-brief";
import { collectAskedQuestions } from "@/lib/asked-questions";
import { ROUND_TYPE_SPECS } from "@/lib/round-types";
import type { AnalysisResult } from "@/lib/response-analyzer";
import type { PersonaConfig } from "@/lib/persona-engine";
import type { SessionLaunchMeta } from "@/lib/session-launch-meta";
import {
  buildLaunchMetaFromSetup,
  readLaunchMeta,
  readLoopProgress,
  withoutDeletedAttachments,
} from "@/lib/session-launch-meta";
import {
  buildRoundScenarioDescription,
  buildRoundScenarioTitle,
  getCurrentRound,
  getNextRoundLoop,
  ROUND_TYPE_LABELS,
} from "@/lib/interview-rounds";
import { resolveScenarioForLaunch } from "@/lib/scenarios";
import type { InterviewSetupState } from "@/lib/interview-setup";
import { unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";
// Calls a model; do not inherit a short platform default. See `api/chat/route.ts`.
export const maxDuration = 60;

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
    jobDescriptionId: string | null;
    resumeId: string | null;
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
    // Either document can be deleted between rounds of a loop, and the
    // snapshot from round one would otherwise name it for every round after.
    ...withoutDeletedAttachments(launch, session),
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

    const completedSessionIds = Array.from(
      new Set([
        ...(readLoopProgress(previous)?.completedSessionIds ?? []),
        previous.id,
      ]),
    );
    const loopId = readLoopProgress(previous)?.loopId ?? crypto.randomUUID();
    const inLoop = await listSessionsInLoop(supabase, loopId);

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
     *
     * Deliberately ahead of the brief: this returns without spending anything,
     * and the brief below reads two tables per completed round.
     */
    const existing = inLoop.find(
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

    /**
     * Hand the next interviewer a note from every round already run.
     *
     * Rebuilt from the loop rather than appended to the inherited string. The
     * old code called `buildLoopBrief` with a one-element array and joined the
     * result onto `launch.loopBrief`, so round 3's brief carried the three-line
     * "Notes from this candidate's earlier rounds" preamble twice and round 4's
     * three times — a growing block of duplicated instruction inside the
     * cacheable prefix. `listSessionsInLoop` was already loaded above for the
     * idempotency check, so rebuilding costs no extra session query.
     *
     * Filtered by ancestry rather than by loop membership: a retried round
     * leaves two sessions at the same index, and `completedSessionIds` is the
     * authoritative record of which chain this one is on. Falls back to
     * `previous` alone for a pre-`0009` row that carries no `loop_id`.
     */
    const chain = inLoop.filter((s) => completedSessionIds.includes(s.id));
    const ranRounds = chain.length > 0 ? chain : [previous];

    const summaries = await Promise.all(
      ranRounds.map(async (session) => {
        const [analyses, messages] = await Promise.all([
          listTurnAnalyses(supabase, session.id),
          listMessages(supabase, session.id, {
            limit: LOOP_BRIEF_TRANSCRIPT_WINDOW,
          }),
        ]);
        // Position in the list is not the round index — a retried round shifts
        // it. Same resolution `/api/loops/[loopId]` uses, for the same reason.
        const loopConfig =
          readLoopProgress(session)?.loop ??
          readLaunchMeta(session)?.interviewLoop;
        const round = loopConfig
          ? getCurrentRound(loopConfig)
          : getCurrentRound(launch.interviewLoop);

        return {
          title: round.title,
          roundTypeLabel: ROUND_TYPE_LABELS[round.type],
          averageScore: session.averageScore,
          analyses: analyses.map(
            (row) => row.analysis as unknown as AnalysisResult,
          ),
          family: ROUND_TYPE_SPECS[round.type].family,
          askedQuestions: collectAskedQuestions(messages),
        };
      }),
    );

    const loopBrief =
      buildLoopBrief(summaries, ROUND_TYPE_SPECS[activeRound.type].family) ??
      launch.loopBrief;

    const launchMeta = {
      ...buildLaunchMetaFromSetup(setup),
      loopBrief: loopBrief || undefined,
    };

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
