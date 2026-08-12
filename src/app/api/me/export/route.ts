import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { listSessions, listMessages } from "@/lib/db/sessions";
import { listPersonas } from "@/lib/db/personas";
import { listJobDescriptions } from "@/lib/db/job-descriptions";
import { unauthorized, handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

/** Cap on transcript rows per session in the export. */
/** Queries in flight at once. Enough to be quick, far from pool-exhausting. */
const EXPORT_CONCURRENCY = 5;
const MESSAGES_PER_SESSION = 500;

/**
 * Bundles the user's data into one downloadable JSON document. The response
 * uses Content-Disposition so the browser saves it as a file.
 */
export async function GET() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `export:${user.id}`,
      RATE_LIMITS.heavyRead,
    );
    if (limited) return limited;

    const [sessionPage, personas, jobDescriptions] = await Promise.all([
      listSessions(supabase, { limit: 500 }),
      listPersonas(supabase, user.id),
      listJobDescriptions(supabase, { limit: 200 }),
    ]);

    /**
     * Inline messages alongside each session so the export is self-contained.
     *
     * In batches, because `Promise.all` over the map issued **one query per
     * session, all at once** — up to 500 simultaneous PostgREST requests from a
     * single click. At 30 requests a minute that is 15,000 concurrent queries,
     * which exhausts the connection pooler for every other user of the project,
     * not just the one exporting.
     */
    const sessionsWithMessages: Array<
      (typeof sessionPage.sessions)[number] & {
        messages: Awaited<ReturnType<typeof listMessages>>;
      }
    > = [];

    for (let i = 0; i < sessionPage.sessions.length; i += EXPORT_CONCURRENCY) {
      const batch = sessionPage.sessions.slice(i, i + EXPORT_CONCURRENCY);
      const withMessages = await Promise.all(
        batch.map(async (session) => ({
          ...session,
          // Bounded per session: an export is a convenience, not an archive
          // guarantee.
          messages: await listMessages(supabase, session.id, {
            limit: MESSAGES_PER_SESSION,
          }),
        })),
      );
      sessionsWithMessages.push(...withMessages);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email ?? null,
        metadata: user.user_metadata ?? null,
      },
      sessions: sessionsWithMessages,
      personas,
      jobDescriptions,
    };

    const filename = `convotrainer-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError("GET /api/me/export", error);
  }
}
