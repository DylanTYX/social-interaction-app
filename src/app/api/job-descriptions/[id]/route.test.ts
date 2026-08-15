import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PATCH on a job description.
 *
 * Two classes of defect worth pinning at the HTTP layer, both of which shipped
 * and neither of which a db-layer test would have caught.
 *
 * **Doing expensive, billable work for an id the caller has no claim to.** RLS
 * means nothing here could ever corrupt someone else's row — but it does not
 * stop the route *trying*. Without an existence check the route ran a full
 * embedding pass, updated zero rows without error (PostgREST does not treat a
 * 0-row update as a failure), and then attempted a chunk insert carrying the
 * caller's `user_id` and the supplied `job_description_id`. Only a unique
 * constraint stood between that and injecting chunks into a job description
 * that happened to have none.
 *
 * **Reporting success for an edit that did not happen.** `rawText` was read
 * with a `typeof` check that quietly discarded anything non-string, so `null`,
 * a number and `""` all returned 200 with the document untouched — while every
 * neighbouring field 400s on exactly the same input.
 */

const getCurrentUser = vi.fn();
const getJobDescription = vi.fn();
const updateJobDescription = vi.fn();
const createEmbeddings = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/job-descriptions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/job-descriptions")>();
  return {
    ...actual,
    getJobDescription: (...args: unknown[]) => getJobDescription(...args),
    updateJobDescription: (...args: unknown[]) => updateJobDescription(...args),
  };
});

// Spied rather than stubbed away: "was this billable call made at all" is the
// assertion, so it has to be observable.
vi.mock("@/lib/embeddings", () => ({
  createEmbedding: vi.fn(),
  createEmbeddings: (...args: unknown[]) => createEmbeddings(...args),
}));

const { PATCH } = await import("@/app/api/job-descriptions/[id]/route");

const JD_ID = "11111111-1111-4111-8111-111111111111";
const SOMEONE_ELSES_ID = "22222222-2222-4222-8222-222222222222";
const LONG_TEXT = "A perfectly valid job description. ".repeat(10);

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/job-descriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}

const RECORD = {
  id: JD_ID,
  title: "Data Analyst at Monzo",
  roleTitle: null,
  company: null,
  sourceUrl: null,
  notes: null,
  sourceType: "text" as const,
  rawText: LONG_TEXT,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({
    user: { id: "user-1" },
    // Every db call is mocked, so the client only has to exist.
    supabase: {},
  });
  getJobDescription.mockResolvedValue(RECORD);
  updateJobDescription.mockResolvedValue(RECORD);
});

describe("PATCH /api/job-descriptions/[id]", () => {
  it("404s an id the caller cannot see, without doing any work", async () => {
    getJobDescription.mockResolvedValue(null);

    const response = await patch(SOMEONE_ELSES_ID, { rawText: LONG_TEXT });

    expect(response.status).toBe(404);
    // The point of the check: no embedding run, and no write attempted.
    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(updateJobDescription).not.toHaveBeenCalled();
  });

  it("rejects a non-string rawText rather than silently succeeding", async () => {
    for (const value of [null, 12345, { text: "hi" }]) {
      const response = await patch(JD_ID, { rawText: value });
      expect(response.status).toBe(400);
    }
    expect(updateJobDescription).not.toHaveBeenCalled();
  });

  it("rejects an empty rawText", async () => {
    // Blank used to reach the update as "key absent" and report 200, so a
    // client that cleared the box was told the edit had landed.
    const response = await patch(JD_ID, { rawText: "   " });

    expect(response.status).toBe(400);
    expect(updateJobDescription).not.toHaveBeenCalled();
  });

  it("passes a valid rawText through", async () => {
    const response = await patch(JD_ID, { rawText: LONG_TEXT });

    expect(response.status).toBe(200);
    expect(updateJobDescription).toHaveBeenCalledWith(
      expect.anything(),
      JD_ID,
      expect.objectContaining({ rawText: LONG_TEXT.trim() }),
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("leaves rawText alone when the key is absent", async () => {
    // A metadata-only edit must not trigger a re-embed; that is what makes
    // renaming a company free and always allowed.
    await patch(JD_ID, { company: "Monzo" });

    const [, , appliedPatch] = updateJobDescription.mock.calls[0];
    expect(appliedPatch).not.toHaveProperty("rawText");
    expect(appliedPatch).toMatchObject({ company: "Monzo" });
  });
});
