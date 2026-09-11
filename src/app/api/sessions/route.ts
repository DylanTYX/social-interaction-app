import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { parseBoundedString, parseLimit, parseOffset, parseOptionalUuid } from "@/lib/api/query";
import {
  normalizeTag,
  parseArchivedView,
  parseScoreBand,
  parseSessionSort,
  parseSinceWindow,
  scoreBandRange,
  sinceToIso,
} from "@/lib/session-organisation";
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

    const limited = enforceRateLimit(
      `sessions:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams, { fallback: 25, max: 100 });
    const offset = parseOffset(searchParams);
    // Filters are applied in Postgres now. They used to be a `useMemo` on the
    // client over whatever had been fetched, so search silently only ever
    // covered the first page.
    const query = searchParams.get("q") ?? undefined;
    const modeParam = searchParams.get("mode");
    const statusParam = searchParams.get("status");
    const mode =
      modeParam === "text" || modeParam === "voice" ? modeParam : undefined;
    const status =
      statusParam === "in_progress" ||
      statusParam === "completed" ||
      statusParam === "abandoned"
        ? statusParam
        : undefined;

    // Organisation filters (migration 0018). All optional, and absent keeps
    // the list exactly as the dashboard and analytics have always read it —
    // including archived sessions, which still count in their statistics.
    const tag = normalizeTag(searchParams.get("tag")) ?? undefined;
    const archived = parseArchivedView(searchParams.get("archived"));
    const sort = parseSessionSort(searchParams.get("sort"));
    const { min: minScore, max: maxScore } = scoreBandRange(
      parseScoreBand(searchParams.get("score")),
    );
    const since = sinceToIso(parseSinceWindow(searchParams.get("since")));

    const { sessions, total } = await listSessions(supabase, {
      limit,
      offset,
      query,
      mode,
      status,
      tag,
      archived,
      sort,
      minScore,
      maxScore,
      since,
    });
    return NextResponse.json({ sessions, total });
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

    const limited = enforceRateLimit(
      `sessions:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const body = await readJsonBody<{
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
    }>(request);

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
      // Validated rather than merely type-checked. These are `uuid` FK columns,
      // and a malformed value reaches Postgres as `22P02` — a 500 with a stack
      // where 404 is correct. A *well-formed* id belonging to someone else is a
      // separate matter: FK triggers bypass RLS, so it inserts cleanly and the
      // interview then runs with no context, which `loadJobDescriptionContext`
      // cannot distinguish from "none attached".
      personaId: parseOptionalUuid(body.personaId, "personaId") ?? null,
      jobDescriptionId:
        parseOptionalUuid(body.jobDescriptionId, "jobDescriptionId") ?? null,
      resumeId: parseOptionalUuid(body.resumeId, "resumeId") ?? null,
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
