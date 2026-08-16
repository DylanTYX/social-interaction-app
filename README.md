# ConvoTrainer

An AI interview-practice application. You describe the role you're preparing
for, shape an interviewer persona, and run a text or voice interview against a
model that adapts its questions to how you actually answer. Every answer is
scored against a round-appropriate rubric, and that score steers the next
question rather than only being reported at the end.

Built with Next.js 16 (App Router), React 19, Supabase (Postgres + pgvector +
RLS), OpenAI, and Azure Speech.

---

## What it does

**Adaptive interviewing.** Each answer is analysed *before* the next question is
generated, and the verdict is fed back into the interviewer's prompt as a
private coaching signal. A vague answer gets drilled for specifics; a strong one
gets pushed a level deeper. The decision engine picks a strategy from the rubric
actually in play — STAR elements on behavioural rounds, problem framing /
correctness / complexity on technical ones.

**Six round types, one or many.** Screening, behavioural, technical SWE, system
design, case, and HR — each with its own rubric, interviewer playbook and
scoring path. Run a single targeted round, or compose a full loop. Round length
is configurable and actually drives how long the interview runs.

**Job-description grounding (RAG).** Upload or paste a job description and it is
chunked, embedded with `text-embedding-3-small`, and stored in pgvector. The
interviewer retrieves the parts relevant to what it is about to probe, so
questions are tailored to the real role. Short postings are inlined whole
instead — at four chunks or fewer, "retrieval" is just reassembling the
document.

**Resume grounding.** Attach a resume and the interviewer reads it — the document
itself, whole — to ask about your actual background and pressure-test the
claims on it. It used to read a model-written summary of the resume instead, which
is why the prompt could confidently probe a claim the candidate never made.

**Multi-round loops.** Compose a realistic loop — screening, then behavioural,
then system design — with a *different interviewer per round*, and a handover
brief so each interviewer knows what the previous one found. A combined report
shows how you tracked across the day.

**Competency coverage.** Questions are model-generated, so nothing guarantees a
session explores a spread of topics. A 12-competency taxonomy is embedded and
matched against each question asked; uncovered competencies steer the
interviewer, and the report shows what was and wasn't explored.

**Voice mode.** Speech-to-text and text-to-speech through Azure Speech, with
delivery metrics (words per minute, filler words, long pauses) computed
client-side.

**Coding rounds.** Technical rounds swap the chat box for a CodeMirror editor
with language selection. Answers are reviewed by the interviewer, not executed.

---

## Getting started

### Prerequisites

- **Node.js ≥ 20.9** (required by Next 16)
- A Supabase project
- An OpenAI API key
- Optional: Azure Speech key + region, for voice mode

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon / publishable key |
| `OPENAI_API_KEY` | yes | Interviewer, analyzer, embeddings |
| `AZURE_SPEECH_KEY` | voice only | Server-side only — never `NEXT_PUBLIC_` |
| `AZURE_SPEECH_REGION` | voice only | e.g. `southeastasia` |

Model overrides (`INTERVIEWER_MODEL`, `ANALYZER_MODEL`, …) are documented in
`.env.local.example`.

### 3. Apply migrations

In the Supabase dashboard → **SQL Editor**, run every file in
`supabase/migrations/` **in numerical order**:

| Migration | Adds |
|---|---|
| `0001_init` | personas, sessions, messages, RLS |
| `0002_job_descriptions` | JD storage, pgvector chunks, retrieval RPC |
| `0003_table_privileges` | grants for the `authenticated` role |
| `0004_resumes` | resume storage |
| `0005_atomic_turns_and_preset_uniqueness` | atomic turn RPC, uniqueness constraints |
| `0006_turn_analyses` | per-turn analysis persistence |
| `0007_llm_usage` | token accounting |
| `0008_resume_profile` | distilled resume profile (**no longer read or written** — see `formatResumeForPrompt`) |
| `0009_session_columns` | server-owned session fields promoted out of JSONB |
| `0010_coach_answers` | cache for generated model answers |
| `0011_integrity_constraints` | value checks moved from route handlers into the database |
| `0012_server_owned_writes` | session and usage writes move behind security-definer functions |
| `0013_job_description_metadata` | JD company, source URL, notes |
| `0014_jd_clean_call_site` | the tidy-up call site in the usage vocabulary |
| `0015_document_metadata` | resume label and notes, truncation records, the `resumes` `updated_at` trigger |

> `0005` and `0006` are **not optional** — `src/lib/db/sessions.ts` calls the
> `append_interview_turn` RPC on every interview turn. Without them the app
> builds and deploys cleanly, then fails on the first message.

### 4. Run

```bash
npm run dev
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests — pure logic only, no network |
| `npm run eval` | **Scoring validation harness — makes live OpenAI calls** |
| `npm run eval:persona` | **Persona differentiation harness** — free and offline by default; `--live` makes billed calls |
| `npm run eval:coach` | **Coaching quality harness** — free and offline by default; `--live` makes billed calls |
| `npm run cost-report` | **Reads `llm_usage` and prices it** — needs `SUPABASE_SERVICE_ROLE_KEY` |

`npm test` currently runs 426 tests, including route-handler tests that
cover auth, input bounds and the prompt trust boundary. CI runs typecheck, lint
and tests on every push and pull request (`.github/workflows/ci.yml`).

The last four are **operator tooling, not product features**. They are not
imported by any route, so Next bundles none of them, and a lint rule in
`eslint.config.mjs` fails the build if anything under `src/app` or
`src/components` tries. See `docs/DEMO.md` → "Who can see what".

### Persona differentiation and cost

```bash
npm run eval:persona                # prompt diff + difficulty curve, no API calls
npm run eval:persona -- --live      # + real follow-ups, scored by a blind judge
npm run cost-report                 # tokens, cache hit rate, cost, counterfactual
npm run cost-report -- --session=<id>
```

`eval:persona` exists because "different personas behave differently" was
asserted throughout this project and never measured. Its deterministic half is
pure arithmetic — `estimateFollowupDifficulty` on an identical answer — so it
reproduces exactly; its `--live` half measures whether the prompt differences
reach the output, using a judge that is never told which persona wrote the text.

`cost-report` is the only thing in this project that multiplies tokens by a
rate. It also reports what the same traffic *would* have cost with no cache
hits, which is the only honest way to state a caching saving.

### Coaching quality

```bash
npm run eval:coach                  # prompt diff + rubric coverage, no API calls
npm run eval:coach -- --live        # + score uplift, measured by the analyzer
```

`eval:coach` exists because the coach behind Quick drills was the one LLM call
in the app graded against nothing — one sentence of rubric guidance covering six
round types, no score, no baseline. Its deterministic half compares the prompt
against the two-branch version it replaced, reproduced verbatim in the harness
as a control: rubric coverage went from **20/29 criteria to 29/29**, with
`screening` and `hr` previously naming *none* of the criteria the analyzer
scores them on. Its `--live` half measures whether the coach's rewrite scores
higher than the candidate's own answer — using the analyzer as scorer, which is
circular in two nameable ways that `docs/COACHING.md` sets out rather than
hides.

### The evaluation harness

`npm run eval` scores a golden set of hand-written answers, each authored to sit
in a known quality band, and reports:

- **Band accuracy** — does the analyzer place answers in the right band?
- **Standard deviation across runs** — the analyzer runs at temperature 0.1;
  this measures whether that is genuinely near-deterministic, which the code has
  always claimed but never tested.
- **Separation** — the gap between strong-answer and weak-answer means. If
  strong and weak don't pull apart, nothing else about the scoring matters.
- **Field completeness** — how often the model omits a required rubric field.
  This is why `jsonrepair` is a dependency at all.

```bash
npm run eval                  # 3 runs per fixture
npm run eval -- --runs=5      # tighter variance estimate
npm run eval -- --json        # machine-readable, for charting
npm run eval -- --only=tech   # filter by id substring or round type
```

It costs real API spend: `fixtures × runs` analyzer calls.

---

## Architecture

```
src/
  app/
    api/            Route handlers — auth-gated, rate-limited, RLS-backed
    simulate/       Setup wizard, text + voice interview, reports
    dashboard/      Sessions, analytics, personas, JDs, resumes, drills
  lib/
    db/             Supabase data access — the only place SQL shapes live
    api/            Cross-cutting route concerns: errors, rate limiting,
                    uploads, token accounting
    response-analyzer.ts    Scores an answer against a round rubric
    decision-engine.ts      Turns a score into the next interview strategy
    interview-rounds.ts     Round types, loops, rubrics
    interview-progress.ts   How long a round runs, derived from its duration
    text-metrics.ts         Countable properties of an answer, computed in code
    competencies.ts         Coverage taxonomy and matching
    loop-brief.ts           Handover note between rounds
    summary.ts              Rolling conversation summary
  eval/             Scoring validation harness
supabase/migrations/
```

**A turn, end to end:** the client posts to `/api/chat` → the previous answer is
analysed → the decision engine picks a strategy → that becomes a private
steering block in the interviewer's prompt → the reply streams back while the
messages and the analysis are written in one transaction.

**Token cost** is instrumented rather than assumed. Every OpenAI call records
its usage — including how much of the prompt came back from OpenAI's cache — to
an `llm_usage` table, so the effect of a prompt change is measurable rather than
argued. Query it directly in the Supabase SQL editor:

```sql
select call_site, avg(prompt_tokens), avg(cached_tokens), count(*)
from llm_usage group by 1;
```

(The `llm_usage_summary` RPC filters on `auth.uid()`, which is null for the
`postgres` role, so it returns nothing from the SQL editor. Query the table.)

Two design decisions worth knowing:

- **The prompt is split into stable and volatile layers.** Instructions,
  persona, scenario and resume are constant for a session and form a
  long cacheable prefix; the coaching signal and rolling summary change per
  turn. This is what makes OpenAI's prompt cache actually hit.
- **Everything stays in Postgres.** Vector search runs through pgvector inside
  Supabase rather than a dedicated vector database, so retrieval is covered by
  the same row-level security as every other table — the retrieval RPC filters
  on `auth.uid()` inside the database, which an external store could not do.

---

## Security

- Row-level security on every table; ownership derived from `auth.uid()`.
- Every API route authenticates; the ones that spend money are rate limited.
- Azure Speech keys stay server-side — the browser only ever receives a
  short-lived token minted by `/api/speech-token`.
- Errors are logged server-side and returned generically, so Postgres and
  OpenAI internals don't reach clients.
- **`llm_usage` is readable by its owner over PostgREST.** Migration `0007`
  grants `select, insert` to `authenticated`, so a logged-in user can read their
  own token counts from devtools even though no UI renders them. RLS blocks
  every other user's rows, there is no update or delete grant, and the price
  table is not in the browser, so cost cannot be derived. Recording is written
  with the user's own session rather than a privileged one, so revoking the
  grant would stop recording — a documented trade-off, not an oversight.
- Security headers (HSTS, `X-Frame-Options`, `Permissions-Policy`) in
  `next.config.ts`. CSP is deliberately deferred until the Azure Speech
  websocket origins are inventoried — see the comment there.

The rate limiter is in-process, which is correct for a single instance and
**not** shared across serverless instances. See `src/lib/api/rate-limit.ts`
before scaling out.

---

## Documentation

- `docs/DEMO.md` — **how the persona and cost mechanisms work, how to prove
  them, and where the developer/end-user boundary sits**
- `docs/FEATURES.md` — **what the app does, written for the end user**
- `docs/TOKEN-COST.md` — **token cost and prompt-caching design, and how to
  verify it**
- `docs/EVALUATION.md` — **how the analyzer's scoring is validated, and the
  limits of that validation**
- `docs/COACHING.md` — **how the coach generates a response, the rubric behind
  it, and how that is measured**
- `docs/DEPLOYMENT.md` — Vercel + Supabase deployment runbook
- `docs/UAT.md` — user-acceptance test plan and exit criteria
- `docs/UAT-tester-handout.md` — participant script
