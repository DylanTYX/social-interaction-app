import type { UsageCollector } from "@/lib/api/token-usage";

const PROFILE_MODEL = process.env.RESUME_PROFILE_MODEL ?? "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** Enough for a dense profile, short enough to stay cheap on every turn. */
const PROFILE_MAX_TOKENS = 400;

/** How much resume text the summariser reads. Two pages fits comfortably. */
const SOURCE_CHARS = 12_000;

const SYSTEM_PROMPT = [
  "You compress a candidate's resume into a dense profile for an AI interviewer.",
  "The interviewer will use it to ask specific questions and pressure-test claims,",
  "so keep every concrete detail an interviewer could probe and drop everything else.",
  "",
  "Keep: employers, titles, dates, scope (team size, scale, budget), technologies,",
  "quantified outcomes, education, and any claim that invites a follow-up.",
  "Drop: formatting, addresses, referees, generic skill lists, soft-skill adjectives,",
  "and boilerplate summary paragraphs.",
  "",
  "Output plain text under these headings, omitting any with nothing to say:",
  "ROLES / SKILLS / EDUCATION / NOTABLE CLAIMS",
  "Never invent anything. If the text is unreadable, output exactly: UNUSABLE",
].join("\n");

/**
 * Distil a resume into a compact profile, once, at upload time.
 *
 * The interviewer prompt previously carried up to 6,000 characters of raw
 * resume on every single turn. That text is stable for the whole session, so
 * paying to re-send it each turn bought nothing — this trades one summarisation
 * call at upload for a much smaller per-turn payload.
 *
 * Returns null on any failure: a resume that cannot be summarised is still
 * perfectly usable via its raw text, so this must never block an upload.
 */
export async function buildResumeProfile(
  rawText: string,
  options: { usage?: UsageCollector } = {},
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const source = rawText.trim().slice(0, SOURCE_CHARS);
  if (!source) return null;

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PROFILE_MODEL,
        temperature: 0.1,
        max_tokens: PROFILE_MAX_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: source },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(
        "[resume-profile] summarisation failed:",
        response.status,
        (await response.text().catch(() => "")).slice(0, 300),
      );
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: Parameters<UsageCollector["record"]>[2];
    };
    options.usage?.record("resume-profile", PROFILE_MODEL, data.usage);

    const profile = data.choices?.[0]?.message?.content?.trim();
    if (!profile || profile === "UNUSABLE") return null;

    return profile;
  } catch (error) {
    console.warn("[resume-profile] summarisation threw:", error);
    return null;
  }
}
