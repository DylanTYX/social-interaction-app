import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PATCH on a resume, and the job description's twin at the HTTP layer.
 *
 * The resume route is cheaper than the job description's — there is nothing to
 * re-embed — so the ownership check is not about billable work here. It is
 * about the two answers a route can give that are worse than an error:
 *
 * **Reporting success for an edit that did not happen.** PostgREST does not
 * treat a zero-row update as a failure, so without the pre-check a PATCH naming
 * any UUID at all returns 200 with a body — and the client believes the edit
 * landed. It also stops the response revealing which ids exist.
 *
 * **Refusing with the wrong status.** A text edit under a running interview is
 * a well-formed request the state of the world says no to, and the count is the
 * actionable part: 409 with the number, not 500.
 */

const getCurrentUser = vi.fn();
const getResume = vi.fn();
const updateResume = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/db/resumes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/resumes")>();
  return {
    ...actual,
    getResume: (...args: unknown[]) => getResume(...args),
    updateResume: (...args: unknown[]) => updateResume(...args),
  };
});

const { PATCH } = await import("@/app/api/resumes/[id]/route");
const { DocumentInUseError } = await import("@/lib/db/document-in-use");

const RESUME_ID = "11111111-1111-4111-8111-111111111111";
const SOMEONE_ELSES_ID = "22222222-2222-4222-8222-222222222222";
const LONG_TEXT = "Senior engineer, distributed systems. ".repeat(10);

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/resumes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

const RECORD = {
  id: RESUME_ID,
  title: "Jane Doe · Resume",
  variant: null,
  notes: null,
  sourceType: "text" as const,
  rawText: LONG_TEXT,
  truncatedFrom: null,
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
  getResume.mockResolvedValue(RECORD);
  updateResume.mockResolvedValue(RECORD);
});

describe("PATCH /api/resumes/[id]", () => {
  it("404s an id the caller cannot see, without attempting a write", async () => {
    getResume.mockResolvedValue(null);

    const response = await patch(SOMEONE_ELSES_ID, { rawText: LONG_TEXT });

    expect(response.status).toBe(404);
    expect(updateResume).not.toHaveBeenCalled();
  });

  it("rejects a non-string rawText rather than silently succeeding", async () => {
    for (const value of [null, 12345, { text: "hi" }]) {
      const response = await patch(RESUME_ID, { rawText: value });
      expect(response.status).toBe(400);
    }
    expect(updateResume).not.toHaveBeenCalled();
  });

  it("rejects an empty rawText", async () => {
    const response = await patch(RESUME_ID, { rawText: "   " });

    expect(response.status).toBe(400);
    expect(updateResume).not.toHaveBeenCalled();
  });

  it("refuses to blank the title", async () => {
    // `title` is `not null` in the schema and every list and picker renders it.
    const response = await patch(RESUME_ID, { title: "" });

    expect(response.status).toBe(400);
    expect(updateResume).not.toHaveBeenCalled();
  });

  it("answers 409 with the count when an interview is mid-way", async () => {
    updateResume.mockRejectedValue(new DocumentInUseError(2, "resume"));

    const response = await patch(RESUME_ID, { rawText: LONG_TEXT });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ inProgress: 2 });
  });

  it("leaves rawText alone when the key is absent", async () => {
    // A metadata-only edit is always allowed, which is only true if it never
    // touches the text.
    await patch(RESUME_ID, { variant: "PM version" });

    const [, , appliedPatch] = updateResume.mock.calls[0];
    expect(appliedPatch).not.toHaveProperty("rawText");
    expect(appliedPatch).toMatchObject({ variant: "PM version" });
  });

  it("passes an over-length rawText through rather than refusing it", async () => {
    // Shortened and said so, exactly as on upload — the db layer applies the
    // cap and records the original length. Refusing here would cap the stored
    // text at the same place and only add friction.
    const oversize = "x".repeat(60_000);

    const response = await patch(RESUME_ID, { rawText: oversize });

    expect(response.status).toBe(200);
    expect(updateResume).toHaveBeenCalledWith(
      expect.anything(),
      RESUME_ID,
      expect.objectContaining({ rawText: oversize }),
    );
  });
});
