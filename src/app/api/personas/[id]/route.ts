import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { deletePersona, updatePersona } from "@/lib/db/personas";
import type { PersonaConfig } from "@/lib/personaEngine";
import { serverError, unauthorized } from "@/lib/api/errors";

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
      return unauthorized();
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
    return serverError("PATCH /api/personas/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id } = await ctx.params;
    await deletePersona(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("DELETE /api/personas/[id]", error);
  }
}
