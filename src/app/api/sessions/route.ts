import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { parseBoundedString, parseLimit } from "@/lib/api/query";
import { parsePersonaConfig } from "@/lib/persona-schema";
import {
  createSession,
  listSessions,
  type PracticeMode,
} from "@/lib/db/sessions";
import {
  buildLoopProgress,
  sanitizeLaunchMeta,
} from "@/lib/session-launch-meta";
import {
  MAX_SCENARIO_DESCRIPTION_CHARS,
  MAX_SCENARIO_TITLE_CHARS,
} from "@/lib/api/input-limits";
import { handleRouteError, unauthorized } from "@/lib/api/errors";

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
    return handleRouteError("GET /api/sessions", error);
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
      // Deliberately `unknown`: it is client-supplied and must go through
      // `sanitizeLaunchMeta` rather than be trusted at its declared type.
      launchMeta?: unknown;
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

    // Sanitized, not cast. `loopBrief` is server-owned and is dropped here;
    // round text is clamped. See `sanitizeLaunchMeta`.
    const launchMeta = sanitizeLaunchMeta(body.launchMeta, practiceMode);
    const loopProgress = launchMeta ? buildLoopProgress(launchMeta) : null;

    const session = await createSession(supabase, user.id, {
      practiceMode,
      scenarioValue,
      scenarioTitle: parseBoundedString(body.scenarioTitle, {
        field: "scenarioTitle",
        max: MAX_SCENARIO_TITLE_CHARS,
      }),
      // Reaches the interviewer's stable prompt layer, so it is billed on every
      // turn of the session rather than once.
      scenarioDescription: parseBoundedString(body.scenarioDescription, {
        field: "scenarioDescription",
        max: MAX_SCENARIO_DESCRIPTION_CHARS,
      }),
      personaId: typeof body.personaId === "string" ? body.personaId : null,
      jobDescriptionId:
        typeof body.jobDescriptionId === "string" ? body.jobDescriptionId : null,
      resumeId: typeof body.resumeId === "string" ? body.resumeId : null,
      personaName: personaConfig.name,
      personaConfig,
      launchMeta,
      // Columns let the loop progress land in the same insert; this used to be
      // a create followed by an immediate patch.
      loopId: loopProgress?.loopId ?? null,
      loopProgress,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleRouteError("POST /api/sessions", error);
  }
}
