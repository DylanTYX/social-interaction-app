import { parseUuid } from "@/lib/api/query";
import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { parsePersonaConfig } from "@/lib/persona-schema";
import { deletePersona, updatePersona } from "@/lib/db/personas";
import { unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    const body = await readJsonBody<{
      name?: string;
      config?: unknown;
    }>(request);
    const config = parsePersonaConfig(body.config);
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
    return handleRouteError("PATCH /api/personas/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    await deletePersona(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("DELETE /api/personas/[id]", error);
  }
}
