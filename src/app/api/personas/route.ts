import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  createPersona,
  listPersonas,
  type PersonaKind,
} from "@/lib/db/personas";
import type { PersonaConfig } from "@/lib/personaEngine";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const personas = await listPersonas(supabase, user.id);
    return NextResponse.json({ personas });
  } catch (error) {
    console.error("[GET /api/personas]", error);
    const message =
      error instanceof Error ? error.message : "Failed to list personas.";
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
    const message =
      error instanceof Error ? error.message : "Failed to create persona.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
