import { parseUuid } from "@/lib/api/query";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  deleteJobDescription,
  getJobDescription,
} from "@/lib/db/job-descriptions";
import { notFound, unauthorized, handleRouteError } from "@/lib/api/errors";

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

    const { id: rawId } = await ctx.params;
    const id = parseUuid(rawId, "id");
    const jobDescription = await getJobDescription(supabase, id);
    if (!jobDescription) {
      return notFound();
    }

    return NextResponse.json({ jobDescription });
  } catch (error) {
    return handleRouteError("GET /api/job-descriptions/[id]", error);
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
    await deleteJobDescription(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("DELETE /api/job-descriptions/[id]", error);
  }
}
