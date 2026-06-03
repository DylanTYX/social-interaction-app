import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { listSessions, listMessages } from "@/lib/db/sessions";
import { listPersonas } from "@/lib/db/personas";
import { listJobDescriptions } from "@/lib/db/job-descriptions";

export const runtime = "nodejs";

/**
 * Bundles the user's data into one downloadable JSON document. The response
 * uses Content-Disposition so the browser saves it as a file.
 */
export async function GET() {
  try {
    const { supabase, user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [sessions, personas, jobDescriptions] = await Promise.all([
      listSessions(supabase, { limit: 500 }),
      listPersonas(supabase, user.id),
      listJobDescriptions(supabase, { limit: 200 }),
    ]);

    // Inline messages alongside each session so the export is self-contained.
    const sessionsWithMessages = await Promise.all(
      sessions.map(async (session) => {
        const messages = await listMessages(supabase, session.id);
        return { ...session, messages };
      }),
    );

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
    const message =
      error instanceof Error ? error.message : "Failed to export data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
