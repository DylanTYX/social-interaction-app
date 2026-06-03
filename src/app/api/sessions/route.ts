import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  createSession,
  listSessions,
  updateSession,
  type PracticeMode,
} from "@/lib/db/sessions";
import type { PersonaConfig } from "@/lib/personaEngine";
import {
  buildLoopProgress,
  type SessionLaunchMeta,
} from "@/lib/session-launch-meta";

export const runtime = "nodejs";

function parsePersonaConfig(value: unknown): PersonaConfig | null {
  if (!value || typeof value !== "object") return null;
  const config = value as Partial<PersonaConfig>;
  if (
    typeof config.name !== "string" ||
    typeof config.nationality !== "string" ||
    typeof config.industry !== "string" ||
    typeof config.seniority !== "string"
  ) {
    return null;
  }
  return config as PersonaConfig;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 100)
        : 25;

    const sessions = await listSessions(supabase, { limit });
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[GET /api/sessions]", error);
    const message =
      error instanceof Error ? error.message : "Failed to list sessions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const message =
      error instanceof Error ? error.message : "Failed to create session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
