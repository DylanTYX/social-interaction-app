import { readJsonBody } from "@/lib/api/read-json";
import { NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

import { getCurrentUser } from "@/lib/supabase/server";
import { UsageCollector, type OpenAIUsage } from "@/lib/api/token-usage";
import { badRequest, handleRouteError, unauthorized } from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseBoundedString } from "@/lib/api/query";
import { MAX_JOB_DESCRIPTION_CHARS } from "@/lib/api/input-limits";
import { completionParams } from "@/lib/model-params";

export const runtime = "nodejs";

const MODEL = process.env.JD_CLEAN_MODEL ?? "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Enough for a long posting plus the JSON wrapper. A cleaned JD is shorter than
 * its input by construction, so this only binds on pathological cases.
 */
const CLEAN_MAX_TOKENS = 4_000;

/** Below this there is nothing to strip and the call would be pure cost. */
const MIN_CLEANABLE_CHARS = 400;

export interface CleanedJobDescription {
  cleanedText: string;
  roleTitle: string | null;
  company: string | null;
}

/**
 * Strip the boilerplate out of a pasted job posting.
 *
 * Copying a listing from a careers page brings the nav, the cookie banner, the
 * "about us" block, the EEO statement and the apply button along with it. All of
 * that is chunked and embedded exactly like the real requirements, and the
 * consequences are concrete rather than aesthetic:
 *
 *   - Retrieval returns a fixed four chunks per turn. Every boilerplate chunk
 *     that scores into the top four displaces a real one, on every turn of
 *     every session using that JD.
 *   - `SMALL_JD_CHUNK_LIMIT` is 4. A JD that cleans down to four chunks or
 *     fewer skips retrieval altogether and gets inlined, which removes a
 *     per-turn embedding round-trip and makes the context lossless instead of
 *     a similarity gamble against `MIN_SIMILARITY`.
 *
 * This is a *quality and latency* change, not a cost saving. The call costs
 * roughly thirty times the embedding tokens it saves. Both numbers are a
 * fraction of a cent, so neither is the point.
 *
 * Deliberately opt-in and non-destructive: it returns the cleaned text for the
 * user to look at, and never writes. The alternative — cleaning silently on
 * save — would put a model between the user and their own document with no way
 * to see what it removed.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { user, supabase } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    // Shares the document-upload budget: this is part of the same "add a JD"
    // flow and should not give a second, separate allowance for model calls.
    const limited = enforceRateLimit(
      `jd-clean:${user.id}`,
      RATE_LIMITS.documentUpload,
    );
    if (limited) return limited;

    const body = await readJsonBody<Record<string, unknown>>(request);
    const rawText =
      parseBoundedString(body.rawText, {
        field: "rawText",
        max: MAX_JOB_DESCRIPTION_CHARS,
      }) ?? "";

    if (rawText.trim().length < MIN_CLEANABLE_CHARS) {
      return badRequest(
        `Paste at least ${MIN_CLEANABLE_CHARS} characters before tidying up.`,
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return handleRouteError(
        "POST /api/job-descriptions/clean",
        new Error("OPENAI_API_KEY is not configured."),
      );
    }

    const systemPrompt = [
      "You extract the substance of a job posting from a page someone has copied and pasted.",
      "The input contains the real posting mixed with page furniture: navigation, cookie notices, 'about the company' marketing, benefits boilerplate, equal-opportunity statements, application instructions, 'share this job', related listings, and footers.",
      "Return ONLY a JSON object with this exact shape:",
      '{"cleanedText": string, "roleTitle": string | null, "company": string | null}',
      "- cleanedText: the posting itself — responsibilities, requirements, qualifications, skills, seniority, team and role-specific context. Preserve the original wording and keep the structure readable with line breaks and simple bullets.",
      "- roleTitle: the job title exactly as advertised, or null if it is not stated.",
      "- company: the hiring organisation, or null if it is not stated.",
      "Rules:",
      "- Copy text through; do not paraphrase, summarise or shorten sentences that belong to the posting.",
      "- Never invent requirements, responsibilities, a title or a company. Absent means null.",
      "- Keep compensation and location when the posting states them; they are part of the role.",
      "- If you cannot tell whether a passage is part of the posting, keep it.",
      "No markdown fences, no commentary outside the JSON.",
    ].join("\n");

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        // Extraction, not composition: the task is to copy the right lines
        // through, and any creativity here shows up as invented requirements.
        ...completionParams(MODEL, {
          temperature: 0,
          maxTokens: CLEAN_MAX_TOKENS,
        }),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rawText },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "[POST /api/job-descriptions/clean] OpenAI rejected the request:",
        response.status,
        detail.slice(0, 500),
      );
      return NextResponse.json(
        { error: "Could not tidy that up. Save it as-is and carry on." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: OpenAIUsage;
    };

    const usage = new UsageCollector();
    usage.record("jd-clean", MODEL, data.usage);
    await usage.flush(supabase);

    // Truncation matters more here than in most places: a cut-off result looks
    // like a successfully shortened document, and saving it would silently drop
    // the back half of the requirements.
    if (data.choices?.[0]?.finish_reason === "length") {
      console.error(
        `[POST /api/job-descriptions/clean] truncated at ${CLEAN_MAX_TOKENS} tokens.`,
      );
      return NextResponse.json(
        { error: "That posting is too long to tidy up. Save it as-is." },
        { status: 502 },
      );
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    let parsed: Partial<CleanedJobDescription>;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = JSON.parse(jsonrepair(content));
    }

    const cleanedText =
      typeof parsed.cleanedText === "string" ? parsed.cleanedText.trim() : "";

    /**
     * Refuse a result that collapsed the document.
     *
     * The failure mode worth guarding is the model deciding the whole posting
     * is boilerplate and handing back a paragraph. The user sees a tidy-looking
     * result, accepts it, and the interview is grounded on a fragment.
     *
     * The floor is deliberately low. A bloated careers page really can be 60%
     * furniture, so a legitimate clean can leave 40% of what went in — anything
     * near a half would reject good results routinely. A fifth is well below
     * any honest clean and still catches collapse.
     */
    if (cleanedText.length < rawText.trim().length * 0.2) {
      return NextResponse.json(
        {
          error:
            "Tidying that up removed too much to be safe. Save it as-is instead.",
        },
        { status: 422 },
      );
    }

    const result: CleanedJobDescription = {
      cleanedText,
      roleTitle:
        typeof parsed.roleTitle === "string" && parsed.roleTitle.trim()
          ? parsed.roleTitle.trim().slice(0, 200)
          : null,
      company:
        typeof parsed.company === "string" && parsed.company.trim()
          ? parsed.company.trim().slice(0, 200)
          : null,
    };

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError("POST /api/job-descriptions/clean", error);
  }
}
