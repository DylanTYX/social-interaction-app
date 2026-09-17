import { NextResponse } from "next/server";

import { handleRouteError, unauthorized } from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { listUsage } from "@/lib/db/usage";
import { summariseUsage } from "@/lib/usage-summary";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** The windows the UI offers, in days. `all` reads the whole history. */
const WINDOW_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  all: null,
};

/**
 * What the caller's own model calls cost, in tokens and in money.
 *
 * Read-only, and scoped to the caller by row-level security. It exists because
 * the app has always *recorded* usage — every interviewer, analyzer, summary,
 * coach and embedding call writes a row — while only a developer CLI could
 * read it back. This is the same accounting, for the person who caused it.
 *
 * The price table stays on the server: what goes over the wire is the finished
 * figure, never the rates. That is the one relaxation of the boundary in
 * `eslint.config.mjs`, which still bars the rate card from every component and
 * every page.
 */
export async function GET(request: Request) {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    // An aggregate over the whole history, so it shares the heavy-read budget
    // with the export, the reports and the analytics breakdown.
    const limited = enforceRateLimit(`usage:${user.id}`, RATE_LIMITS.heavyRead);
    if (limited) return limited;

    const params = new URL(request.url).searchParams;
    const sessionId = params.get("session");
    const requestedWindow = params.get("window") ?? "30d";
    // An unknown window falls back rather than failing: this is a read with no
    // side effects, and a wrong window is not worth an error screen.
    const days = requestedWindow in WINDOW_DAYS ? WINDOW_DAYS[requestedWindow] : 30;

    // A session's usage is all of it, however old the session is.
    const since =
      sessionId || days === null
        ? null
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const records = await listUsage(supabase, { since, sessionId });

    return NextResponse.json({
      window: sessionId ? "session" : requestedWindow in WINDOW_DAYS ? requestedWindow : "30d",
      since: since?.toISOString() ?? null,
      usage: summariseUsage(records),
    });
  } catch (error) {
    return handleRouteError("GET /api/me/usage", error);
  }
}
