import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { deletePersona, updatePersona } from "@/lib/db/personas";
import type { PersonaConfig } from "@/lib/personaEngine";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const body = (await request.json()) as {
      name?: string;
      config?: unknown;
    };
    const config = parseConfig(body.config);
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : config?.name?.trim();

    if (!config || !name) {
      return NextResponse.json(
        {
          error: "Missing required fields. Expected `name` and `config`.",
        },
        { status: 400 },
      );
    }

    const persona = await updatePersona(supabase, id, {
      name,
      config: { ...config, name },
    });

    return NextResponse.json({ persona });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update persona.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    await deletePersona(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete persona.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
