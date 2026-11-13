/**
 * Preflight for a model change: does OpenAI accept the requests the app sends?
 *
 *   npm run eval:models                 # the models the app runs today
 *   npm run eval:models -- --candidates # the migration targets (see models.ts)
 *
 * One tiny request per call site (about $0.001 in all), shaped exactly like the
 * app's own — same parameters, same response format, same streaming. It answers
 * the question the quality harnesses cannot afford to find out the hard way:
 * would every call return a 400? Run it first; run `eval`, `eval:persona` and
 * `eval:coach` only when it is clean.
 *
 * It also tells a bad key from a bad request. A rejected key (401) is reported
 * once, up front, instead of as seven identical failures.
 *
 * Exit status is non-zero when any request fails.
 */

import {
  buildChecks,
  candidateModels,
  currentModels,
  type CheckRequest,
} from "./model-check";

interface Outcome {
  check: CheckRequest;
  ok: boolean;
  detail: string;
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const message = (JSON.parse(text) as { error?: { message?: string } }).error
      ?.message;
    if (message) return message.replace(/\s+/g, " ").slice(0, 160);
  } catch {
    // not JSON; fall through to the raw text
  }
  return text.replace(/\s+/g, " ").slice(0, 160);
}

async function run(check: CheckRequest, apiKey: string): Promise<Outcome> {
  const response = await fetch(check.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(check.body),
  });

  if (!response.ok) {
    return {
      check,
      ok: false,
      detail: `HTTP ${response.status}: ${await errorMessage(response)}`,
    };
  }

  if (check.stream) {
    const text = await response.text();
    const sawUsage = /"usage":\s*\{/.test(text);
    return {
      check,
      ok: sawUsage,
      detail: sawUsage
        ? "streamed, usage frame received"
        : "streamed, but no usage frame came back",
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (check.url.endsWith("/embeddings")) {
    return { check, ok: true, detail: "embedding returned" };
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  if (check.expectsJson) {
    try {
      JSON.parse(content);
    } catch {
      return {
        check,
        ok: false,
        detail: `accepted, but the reply is not JSON: ${JSON.stringify(content).slice(0, 80)}`,
      };
    }
  }
  const finish = data.choices?.[0]?.finish_reason ?? "?";
  return {
    check,
    ok: true,
    detail: `ok (finish_reason ${finish}, ${data.usage?.completion_tokens ?? "?"} output tokens)`,
  };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set.");
    process.exitCode = 1;
    return;
  }

  const candidates = process.argv.includes("--candidates");
  const models = candidates ? candidateModels() : currentModels();
  console.log(
    candidates
      ? "Checking the migration candidates (the models the defaults would move to)\n"
      : "Checking the models the app runs today\n",
  );

  const checks = buildChecks(models);

  // The embeddings call has no override and nothing to do with a model change,
  // so it doubles as the key test: if it is rejected, say so once and stop.
  const keyTest = await run(checks[checks.length - 1], apiKey);
  if (!keyTest.ok && /HTTP 401/.test(keyTest.detail)) {
    console.error(
      `The key was rejected (${keyTest.detail}).\nFix OPENAI_API_KEY in .env.local, then run this again.`,
    );
    process.exitCode = 1;
    return;
  }

  const outcomes: Outcome[] = [];
  for (const check of checks) {
    outcomes.push(await run(check, apiKey));
  }

  for (const { check, ok, detail } of outcomes) {
    console.log(
      `${ok ? "ok  " : "FAIL"}  ${check.site.padEnd(11)} ${check.model.padEnd(24)} ${detail}`,
    );
  }

  const failed = outcomes.filter((o) => !o.ok);
  console.log(
    failed.length
      ? `\n${failed.length} of ${outcomes.length} failed. Do not switch the defaults; see the messages above.`
      : `\nAll ${outcomes.length} accepted. The quality harnesses can run.`,
  );
  if (failed.length) process.exitCode = 1;
}

void main();
