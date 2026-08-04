import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { listMessages } from "@/lib/db/sessions";
import { serverError, unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteParams) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const { id } = await ctx.params;
    const messages = await listMessages(supabase, id);
    return NextResponse.json({ messages });
  } catch (error) {
    return serverError("GET /api/sessions/[id]/messages", error);
  }
}
