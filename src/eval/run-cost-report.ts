/**
 * What the app has actually spent, read from `llm_usage`.
 *
 *   npm run cost-report                  # everything recorded
 *   npm run cost-report -- --since=7d    # last 7 days
 *   npm run cost-report -- --session=<id>
 *   npm run cost-report -- --json
 *
 * `docs/TOKEN-COST.md` has carried this warning since it was written:
 *
 *   > The estimates have not been validated against live traffic — the Supabase
 *   > project has been unreachable throughout this work, so the `llm_usage`
 *   > table has never been queried with real rows in it.
 *
 * This is the tool that removes it. Every figure printed here is measured.
 *
 * Two things it does that the SQL editor cannot:
 *
 *   - The shipped `llm_usage_summary` RPC filters on `auth.uid()`, which is null
 *     for the `postgres` role, so it returns nothing when run by hand. This
 *     connects with the service-role key and queries the table directly.
 *   - It multiplies by a rate. Nothing else in the project ever has.
 *
 * Reads only. It never writes, and it never prints a key.
 */

import { createClient } from "@supabase/supabase-js";

import type { LlmCallSite, UsageRecord } from "@/lib/api/token-usage";
import { formatUsd, PRICING_CHECKED_ON, summariseCost } from "@/lib/pricing";

interface UsageRow {
  call_site: LlmCallSite;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  session_id: string | null;
  created_at: string;
}

function toRecord(row: UsageRow): UsageRecord {
  return {
    callSite: row.call_site,
    model: row.model,
    promptTokens: row.prompt_tokens ?? 0,
    completionTokens: row.completion_tokens ?? 0,
    cachedTokens: row.cached_tokens ?? 0,
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) =>
    args.find((a) => a.startsWith(`--${flag}=`))?.split("=")[1];

  const since = get("since");
  let sinceIso: string | null = null;
  if (since) {
    const days = Number(since.replace(/d$/, ""));
    sinceIso = Number.isFinite(days)
      ? new Date(Date.now() - days * 86_400_000).toISOString()
      : since;
  }

  return {
    sinceIso,
    session: get("session") ?? null,
    json: args.includes("--json"),
  };
}

async function main() {
  const { sinceIso, session, json } = parseArgs();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Naming which one is missing, because the usual failure is a key present
    // in .env.local with an empty value — which reads as "set" at a glance.
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    console.error(`Missing or empty in .env.local: ${missing.join(", ")}`);
    console.error(
      "  Supabase dashboard -> Project Settings -> API -> service_role key.",
    );
    console.error(
      "  It bypasses RLS, so keep it server-side only and never commit it.",
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  let query = supabase
    .from("llm_usage")
    .select(
      "call_site, model, prompt_tokens, completion_tokens, cached_tokens, session_id, created_at",
    )
    .order("created_at", { ascending: true });

  if (sinceIso) query = query.gte("created_at", sinceIso);
  if (session) query = query.eq("session_id", session);

  const { data, error } = await query;
  if (error) {
    console.error(`Query failed: ${error.message}`);
    // The single likeliest cause, and the one a demo hits an hour beforehand.
    if (error.message.includes("does not exist")) {
      console.error(
        "  `llm_usage` is missing — apply supabase/migrations/0007_llm_usage.sql.",
      );
    }
    process.exitCode = 1;
    return;
  }

  const rows = (data ?? []) as UsageRow[];
  if (rows.length === 0) {
    console.log(
      "No usage recorded yet. Run an interview first — every model call writes a row.",
    );
    return;
  }

  const records = rows.map(toRecord);
  const overall = summariseCost(records);

  // Per call site, so the question "what does each component cost" has an
  // answer. This is the grouping docs/TOKEN-COST.md asks for in its SQL.
  const bySite = new Map<LlmCallSite, UsageRecord[]>();
  for (const record of records) {
    const list = bySite.get(record.callSite) ?? [];
    list.push(record);
    bySite.set(record.callSite, list);
  }

  const sessions = new Set(rows.map((r) => r.session_id).filter(Boolean));
  const interviewerCalls = bySite.get("interviewer")?.length ?? 0;

  const siteRows = [...bySite.entries()]
    .map(([site, list]) => {
      const summary = summariseCost(list);
      return {
        callSite: site,
        calls: list.length,
        avgPrompt: summary.promptTokens / list.length,
        avgCached: summary.cachedTokens / list.length,
        avgCompletion: summary.completionTokens / list.length,
        totalUsd: summary.totalUsd,
        cacheHitRate: summary.cacheHitRate,
      };
    })
    .sort((a, b) => b.totalUsd - a.totalUsd);

  if (json) {
    console.log(
      JSON.stringify(
        {
          pricingCheckedOn: PRICING_CHECKED_ON,
          rows: rows.length,
          sessions: sessions.size,
          overall,
          bySite: siteRows,
        },
        null,
        2,
      ),
    );
    return;
  }

  const pad = (v: string | number, n: number) => String(v).padStart(n);

  console.log(`\n${rows.length} calls across ${sessions.size} sessions`);
  console.log(
    `Prices checked ${PRICING_CHECKED_ON} — re-check before quoting.\n`,
  );

  console.log(
    "call site       calls   avg in  avg cached  avg out       cost   cache",
  );
  console.log("-".repeat(72));
  for (const row of siteRows) {
    console.log(
      [
        row.callSite.padEnd(14),
        pad(row.calls, 6),
        pad(row.avgPrompt.toFixed(0), 8),
        pad(row.avgCached.toFixed(0), 12),
        pad(row.avgCompletion.toFixed(0), 9),
        pad(formatUsd(row.totalUsd), 11),
        pad(`${(row.cacheHitRate * 100).toFixed(0)}%`, 8),
      ].join(""),
    );
  }

  console.log(`\n--- totals ---`);
  console.log(
    `Tokens             ${overall.promptTokens} in / ${overall.completionTokens} out`,
  );
  console.log(
    `Cached             ${overall.cachedTokens} (${(overall.cacheHitRate * 100).toFixed(1)}% of input)`,
  );
  console.log(`Cost               ${formatUsd(overall.totalUsd)}`);
  if (sessions.size > 0) {
    console.log(
      `  per session      ${formatUsd(overall.totalUsd / sessions.size)}`,
    );
  }
  if (interviewerCalls > 0) {
    console.log(
      `  per turn         ${formatUsd(overall.totalUsd / interviewerCalls)}  (${interviewerCalls} interviewer calls)`,
    );
  }

  console.log(`\n--- what caching saved ---`);
  console.log(`Billed             ${formatUsd(overall.totalUsd)}`);
  console.log(`Without caching    ${formatUsd(overall.withoutCachingUsd)}`);
  console.log(`Saved              ${formatUsd(overall.savedByCachingUsd)}`);

  if (overall.cachedTokens === 0) {
    // Not a bug, and worth saying out loud rather than leaving as a zero the
    // reader has to interpret. docs/TOKEN-COST.md predicts exactly this.
    console.log(
      [
        "",
        "  Zero cached tokens. This is the predicted result, not a failure:",
        "  OpenAI only caches prefixes of 1,024+ tokens, and the interviewer's",
        "  stable prefix on a bare session is ~590. Attach a job description or",
        "  a CV and it clears the floor. Compare with --session=<id> either way.",
      ].join("\n"),
    );
  }

  if (overall.unpricedModels.length) {
    console.log(
      `\nUnpriced models: ${overall.unpricedModels.join(", ")} — add them to src/lib/pricing.ts.`,
    );
  }

  // A per-model line, because a model switch is the single change most likely
  // to move these numbers and it would otherwise be invisible here.
  const models = new Map<string, UsageRecord[]>();
  for (const record of records) {
    const list = models.get(record.model) ?? [];
    list.push(record);
    models.set(record.model, list);
  }
  if (models.size > 1) {
    console.log(`\n--- by model ---`);
    for (const [model, list] of models) {
      const summary = summariseCost(list);
      console.log(
        `  ${model.padEnd(26)} ${pad(list.length, 5)} calls  ${formatUsd(summary.totalUsd)}`,
      );
    }
  }
}

void main();
