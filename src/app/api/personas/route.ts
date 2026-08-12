import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { parsePersonaConfig } from "@/lib/persona-schema";
import {
  createPersona,
  listPersonas,
  type PersonaKind,
} from "@/lib/db/personas";
import { unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `personas:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const personas = await listPersonas(supabase, user.id);
    return NextResponse.json({ personas });
  } catch (error) {
    return handleRouteError("GET /api/personas", error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `personas:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const body = await readJsonBody<{
      name?: string;
      config?: unknown;
      kind?: string;
    }>(request);
    const config = parsePersonaConfig(body.config);
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : config?.name?.trim();

    if (!config || !name) {
      return NextResponse.json(
        {
          error:
            "Missing required fields. Expected `name` and `config` (PersonaConfig).",
        },
        { status: 400 },
      );
    }

    /**
     * Always "user". A preset is something we ship, not something a client
     * declares.
     *
     * This used to honour `kind: "preset"` from the body, which mattered
     * because `resetPersonaPresets` deletes rows of that kind and overwrites
     * same-named ones: a persona a user created could be silently destroyed by
     * a button labelled "Restore presets". Seeding real presets happens in
     * `listPersonas`, server-side, and never through this route.
     */
    const kind: PersonaKind = "user";

    const persona = await createPersona(supabase, user.id, {
      name,
      config: { ...config, name },
      kind,
    });

    return NextResponse.json({ persona }, { status: 201 });
  } catch (error) {
    return handleRouteError("POST /api/personas", error);
  }
}
