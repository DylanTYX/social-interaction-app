import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { parseLimit } from "@/lib/api/query";
import { parsePersonaConfig } from "@/lib/persona-schema";
import {
  createSession,
  listSessions,
  updateSession,
  type PracticeMode,
} from "@/lib/db/sessions";
import {
  buildLoopProgress,
  type SessionLaunchMeta,
} from "@/lib/session-launch-meta";
import { serverError, unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams, { fallback: 25, max: 100 });

    const sessions = await listSessions(supabase, { limit });
    return NextResponse.json({ sessions });
  } catch (error) {
    return serverError("GET /api/sessions", error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as {
      practiceMode?: string;
      scenarioValue?: string;
      scenarioTitle?: string;
      scenarioDescription?: string;
      personaId?: string;
      jobDescriptionId?: string | null;
      resumeId?: string | null;
      personaConfig?: unknown;
      launchMeta?: SessionLaunchMeta;
    };

    const practiceMode: PracticeMode =
      body.practiceMode === "voice" ? "voice" : "text";
    const scenarioValue =
      typeof body.scenarioValue === "string" && body.scenarioValue.trim()
        ? body.scenarioValue.trim()
        : null;
    const personaConfig = parsePersonaConfig(body.personaConfig);

    if (!scenarioValue || !personaConfig) {
      return NextResponse.json(
        {
          error:
            "Missing required fields. Expected `scenarioValue` and `personaConfig`.",
        },
        { status: 400 },
      );
    }

    const launchMeta =
      body.launchMeta && typeof body.launchMeta === "object"
        ? (body.launchMeta as SessionLaunchMeta)
        : null;

    let session = await createSession(supabase, user.id, {
      practiceMode,
      scenarioValue,
      scenarioTitle:
        typeof body.scenarioTitle === "string" ? body.scenarioTitle : null,
      scenarioDescription:
        typeof body.scenarioDescription === "string"
          ? body.scenarioDescription
          : null,
      personaId: typeof body.personaId === "string" ? body.personaId : null,
      jobDescriptionId:
        typeof body.jobDescriptionId === "string" ? body.jobDescriptionId : null,
      resumeId: typeof body.resumeId === "string" ? body.resumeId : null,
      personaName: personaConfig.name,
      personaConfig,
      metrics: launchMeta ? { launch: launchMeta } : null,
    });

    if (launchMeta) {
      const loop = buildLoopProgress(launchMeta, session.id);
      session = await updateSession(supabase, session.id, {
        metrics: {
          launch: launchMeta,
          loop,
        },
      });
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return serverError("POST /api/sessions", error);
  }
}
