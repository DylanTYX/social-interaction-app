import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/supabase/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import { handleRouteError, unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

/**
 * Where a client-side crash goes.
 *
 * The three `error.tsx` boundaries each called `console.error` — in the *user's*
 * browser. Nothing was transmitted, so a render crash left no record anywhere,
 * and `error.digest` was shown to the user as a "Reference" that no server log
 * contained. Asking someone to quote a reference number nobody can look up is
 * worse than showing nothing.
 *
 * Deliberately not an error-reporting SDK: that is a vendor decision, and this
 * needs none. It puts the failure in the same place every other server-side
 * failure already goes, with the user and route attached so a report can
 * actually be found.
 *
 * Authenticated, because the boundaries only render behind a session and an
 * open endpoint here would be a free log-flooding primitive.
 */

const MAX_FIELD_CHARS = 2_000;

function clamp(value: unknown, max = MAX_FIELD_CHARS): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(request: Request) {
  try {
    const { user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `clientError:${user.id}`,
      RATE_LIMITS.standard,
    );
    if (limited) return limited;

    const body = await readJsonBody<{
      scope?: unknown;
      message?: unknown;
      digest?: unknown;
      stack?: unknown;
      pathname?: unknown;
    }>(request, 16 * 1024);

    // Everything is clamped: this is attacker-controlled text heading for a log
    // line, and an unbounded stack would be an easy way to fill the log budget.
    console.error("[client-error]", {
      userId: user.id,
      scope: clamp(body.scope, 60) ?? "unknown",
      pathname: clamp(body.pathname, 200),
      digest: clamp(body.digest, 100),
      message: clamp(body.message),
      stack: clamp(body.stack, 4_000),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("POST /api/client-errors", error);
  }
}
