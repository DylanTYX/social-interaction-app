import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  createPersona,
  listPersonas,
  type PersonaKind,
} from "@/lib/db/personas";
import type { PersonaConfig } from "@/lib/personaEngine";
import { serverError, unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

function parseConfig(value: unknown): PersonaConfig | null {
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

export async function GET() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const personas = await listPersonas(supabase, user.id);
    return NextResponse.json({ personas });
  } catch (error) {
    return serverError("GET /api/personas", error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as {
      name?: string;
      config?: unknown;
      kind?: string;
    };
    const config = parseConfig(body.config);
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

    const kind: PersonaKind = body.kind === "preset" ? "preset" : "user";

    const persona = await createPersona(supabase, user.id, {
      name,
      config: { ...config, name },
      kind,
    });

    return NextResponse.json({ persona }, { status: 201 });
  } catch (error) {
    return serverError("POST /api/personas", error);
  }
}
