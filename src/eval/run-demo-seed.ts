/**
 * Create or refresh the seeded demo account.
 *
 *   npm run seed:demo                 # dry run: prints what it would write
 *   npm run seed:demo -- --confirm    # writes it
 *
 * Environment (read from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   required
 *   DEMO_EMAIL      default demo@convotrainer.dev
 *   DEMO_PASSWORD   optional; a new account without one gets a generated
 *                   password, printed once; an existing account keeps its own
 *
 * Safety, because the service role key bypasses row-level security:
 *
 *   - Nothing is written without `--confirm`.
 *   - It only ever touches the one account named by DEMO_EMAIL, and only if
 *     this script created that account (`app_metadata.demo_seed`). An existing
 *     real account with the same email is refused, never overwritten.
 *   - A re-run replaces the account's sessions and its seeded resume. Anything
 *     else you added on it, such as a job description, is left alone.
 *
 * The history is seeded, not measured. See `demo-seed.ts` and docs/DEMO.md.
 */

import { randomBytes, randomUUID } from "node:crypto";

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import {
  applyLoops,
  buildDemoDataset,
  DEMO_CANDIDATE_NAME,
  type DemoDataset,
} from "@/eval/demo-seed";

const DEFAULT_EMAIL = "demo@convotrainer.dev";

async function findUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<User | null> {
  const target = email.toLowerCase();
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === target,
    );
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  return null;
}

function describe(dataset: DemoDataset): string {
  const byType = new Map<string, number>();
  let voice = 0;
  let answers = 0;
  for (const session of dataset.sessions) {
    const type = String(
      (
        session.row.launch_meta as {
          interviewLoop: {
            rounds: { type: string }[];
            currentRoundIndex: number;
          };
        }
      ).interviewLoop.rounds[
        (
          session.row.launch_meta as {
            interviewLoop: { currentRoundIndex: number };
          }
        ).interviewLoop.currentRoundIndex
      ].type,
    );
    byType.set(type, (byType.get(type) ?? 0) + 1);
    if (session.row.practice_mode === "voice") voice += 1;
    answers += session.analyses.length;
  }
  return [
    `${dataset.sessions.length} sessions (${[...byType.entries()]
      .map(([type, count]) => `${count} ${type}`)
      .join(", ")}), ${voice} spoken`,
    `${answers} scored answers, with transcripts`,
    "1 interview loop of three rounds",
    `1 resume ("${dataset.resume.title}")`,
  ].join("\n  ");
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = (process.env.DEMO_EMAIL || DEFAULT_EMAIL).trim();

  if (!url) {
    console.error("Missing or empty in .env.local: NEXT_PUBLIC_SUPABASE_URL");
    process.exitCode = 1;
    return;
  }

  const dataset = buildDemoDataset({ now: new Date(), newId: randomUUID });
  applyLoops(dataset, randomUUID);

  console.log(`Supabase project: ${new URL(url).host}`);
  console.log(`Demo account:     ${email}`);
  console.log(`Would write:\n  ${describe(dataset)}`);

  if (!confirm) {
    console.log(
      "\nDry run. Nothing was written. Re-run with `npm run seed:demo -- --confirm` to seed.",
    );
    return;
  }

  // Only the write needs the key; a dry run never connects.
  if (!serviceKey) {
    console.error(
      "\nMissing or empty in .env.local: SUPABASE_SERVICE_ROLE_KEY. It is in Supabase under Project Settings, API keys. Keep it out of Vercel unless you need it there.",
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let user = await findUserByEmail(supabase, email);
  let password: string | null = process.env.DEMO_PASSWORD || null;

  if (user && user.app_metadata?.demo_seed !== true) {
    console.error(
      `\nRefusing: ${email} already exists and was not created by this script. Set DEMO_EMAIL to an address that is only used for the demo.`,
    );
    process.exitCode = 1;
    return;
  }

  if (!user) {
    password = password ?? `demo-${randomBytes(9).toString("base64url")}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: DEMO_CANDIDATE_NAME },
      app_metadata: { demo_seed: true },
    });
    if (error) throw error;
    user = data.user;
    console.log("\nCreated the demo account.");
  } else {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      ...(password ? { password } : {}),
      user_metadata: { full_name: DEMO_CANDIDATE_NAME },
    });
    if (error) throw error;
    console.log("\nFound the demo account. Replacing its seeded history.");
  }

  const userId = user.id;

  // Sessions cascade to their messages, analyses and cached coaching.
  const cleared = await supabase
    .from("interview_sessions")
    .delete()
    .eq("user_id", userId);
  if (cleared.error) throw cleared.error;
  const clearedResume = await supabase
    .from("resumes")
    .delete()
    .eq("user_id", userId)
    .eq("title", dataset.resume.title);
  if (clearedResume.error) throw clearedResume.error;

  const resume = await supabase.from("resumes").insert({
    ...dataset.resume,
    user_id: userId,
    notes: "Seeded for the demo.",
  });
  if (resume.error) throw resume.error;

  const sessions = await supabase.from("interview_sessions").insert(
    dataset.sessions.map((session) => ({
      ...session.row,
      user_id: userId,
      resume_id: session.withResume ? dataset.resume.id : null,
    })),
  );
  if (sessions.error) throw sessions.error;

  const messageRows = dataset.sessions.flatMap((session) =>
    session.messages.map((message) => ({ ...message, session_id: session.id })),
  );
  const messages = await supabase
    .from("interview_messages")
    .insert(messageRows)
    .select("id, session_id, turn_index");
  if (messages.error) throw messages.error;

  const messageId = new Map(
    (messages.data ?? []).map((row) => [
      `${row.session_id}:${row.turn_index}`,
      row.id as string,
    ]),
  );
  const analyses = await supabase.from("interview_turn_analyses").insert(
    dataset.sessions.flatMap((session) =>
      session.analyses.map((analysis) => ({
        ...analysis,
        session_id: session.id,
        message_id:
          messageId.get(`${session.id}:${analysis.turn_index}`) ?? null,
        created_at: session.messages.find(
          (message) => message.turn_index === analysis.turn_index,
        )?.created_at,
      })),
    ),
  );
  if (analyses.error) throw analyses.error;

  console.log(`Seeded:\n  ${describe(dataset)}`);
  console.log(`\nSign in as ${email}`);
  console.log(
    password
      ? `Password: ${password}`
      : "Password: unchanged (set DEMO_PASSWORD to reset it).",
  );
  console.log(
    "\nBefore the demo: sign in once to dismiss the welcome dialog, and add a job description in the app so the live interview can use it.",
  );
  console.log(
    "This history is seeded. Say so when you show it, and never quote its numbers as evaluation results.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
