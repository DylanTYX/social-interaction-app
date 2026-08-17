# Data model

Nine tables, six functions, fifteen migrations, one authorisation rule. This is
what is stored, how it relates, who can read it, and which parts the client is
not allowed to write.

Everything lives in one Postgres database (Supabase). There is no second store —
not for vectors, not for sessions, not for a cache. [Why that is deliberate is in
DESIGN-DECISIONS.md §2](DESIGN-DECISIONS.md).

---

## The shape

```
auth.users
  │
  ├─< personas                    a saved interviewer
  ├─< job_descriptions ─< job_description_chunks   (pgvector)
  ├─< resumes
  ├─< llm_usage                   token accounting, per call
  │
  └─< interview_sessions          ONE ROW PER ROUND
        │   ├─ loop_id ────────── chains the rounds of a loop
        │   ├─ persona_config     frozen at creation, not a live FK read
        │   ├─ launch_meta        the setup, including the server-owned loopBrief
        │   └─ competency_coverage
        │
        ├─< interview_messages           the transcript
        ├─< interview_turn_analyses      one score per answered turn
        └─< coach_answers                cached model answers, per turn
```

Every table hangs off `auth.users` directly or through a session. Every foreign
key to a user is `on delete cascade`, so deleting an account removes everything.

---

## Tables

### `interview_sessions` — the spine

One row per **round**, not per interview. A four-round loop is four rows sharing
a `loop_id`.

| Column                                                       | Why it exists                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `practice_mode`                                              | `text` or `voice`, checked                                                                                                                                                                                                                 |
| `scenario_value`, `scenario_title`, `scenario_description`   | The role brief; the description carries this round's title, type, rubric and focus                                                                                                                                                         |
| `persona_id`, `persona_name`, `persona_config`               | The interviewer. **`persona_config` is a frozen copy**, not read live through the FK — editing a saved persona must not retroactively change an interview that already happened. `persona_id` is `on delete set null` for the same reason. |
| `status`                                                     | `in_progress` / `completed` / `abandoned`                                                                                                                                                                                                  |
| `summary`                                                    | The rolling summary, maintained server-side and sent instead of the full transcript, so tokens stay bounded                                                                                                                                |
| `turn_count`, `average_score`, `duration_minutes`, `metrics` | Aggregates                                                                                                                                                                                                                                 |
| `loop_id`, `loop_progress`                                   | Loop chaining (migration `0009`)                                                                                                                                                                                                           |
| `launch_meta`                                                | The setup that produced this round — including `loopBrief`, which is **server-owned**                                                                                                                                                      |
| `competency_coverage`                                        | The 12-slot coverage vector, accumulated as the round runs                                                                                                                                                                                 |

### `interview_messages` — the transcript

`session_id`, `role` (`user`/`assistant`, checked), `content`, `turn_index`.

Deliberately plain text. A code answer travels through the same `content` column
fenced with its language tag, so the whole persistence path — the append RPC, the
transcript, the summary — never needed a parallel field. The analyzer detects
code by sniffing the fence.

### `interview_turn_analyses` — one score per answered turn

`unique (session_id, turn_index)`, which is what makes the append RPC idempotent
under retry.

`message_id` is `on delete set null` rather than cascade, and the migration says
why: deleting a message must not silently erase the evaluation data attached to
it.

### `job_descriptions` + `job_description_chunks`

The parent holds the raw text, company, source URL, notes and truncation record.
The child holds overlapping chunks with a `vector` column and an index.
Retrieval is the `match_job_description_chunks` RPC.

Short documents are never chunked — at four chunks or fewer, retrieval is just
reassembling the document, so it is inlined whole and moves into the cacheable
prompt prefix instead.

### `resumes`

Raw text, title, `variant` and `notes` (library-only — neither reaches a prompt),
and a truncation record. `resume_profile` from migration `0008` still exists and
is **no longer read or written**: the distilled 400-token profile was removed so
the interviewer reads the candidate's actual words.

### `personas`

Saved interviewer configurations. Six ship as presets and can be restored.

### `llm_usage`

One row per model call: `call_site`, `model`, `prompt_tokens`,
`completion_tokens`, `cached_tokens`. Written with the user's own session rather
than a privileged one — a documented trade-off, since revoking the grant would
stop recording.

**Readable by its owner over PostgREST.** Migration `0007` grants `select, insert`
to `authenticated`, so a logged-in user can read their own token counts from
devtools. RLS blocks every other user's rows, there is no update or delete grant,
and the price table is not in the browser, so cost cannot be derived from it.

### `coach_answers`

Cached `{modelAnswer, rewrite, tips}` keyed by `(session_id, turn_index)`, unique.
Nothing about a completed turn changes, so a second look at the same report is not
a second bill. **Quick Drills deliberately do not use it** — a drill has no session
and no turn, so every drill submission is a full billed call.

---

## Authorisation: one rule, applied nine times

Row-level security is on for every table, and every policy is the same shape:

```sql
create policy "<table>_owner_all" on <table>
  for all using (auth.uid() = user_id);
```

Child tables reach the owner through their parent. The important consequence:
**the pgvector retrieval RPC filters on `auth.uid()` inside the database**, so a
candidate's job-description chunks are covered by exactly the same rule as
everything else. That is the property an external vector store could not give.

### What the client is not allowed to write

Three things are server-owned and enforced below the route layer:

| Field                   | Enforced by                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `launch_meta.loopBrief` | `sanitizeLaunchMeta` strips it on POST; PATCH strips it. Only `next-round` writes it. |
| Session progress        | `update_session_progress`, a `security definer` function (migration `0012`)           |
| Usage rows              | `record_llm_usage`, likewise                                                          |

`loopBrief` matters most: it lands **verbatim in a system prompt**, and since the
cross-round handover it carries the previous interviewer's own questions. Both
ends are server-generated, and the collector skips `role: "user"` turns — asserted
by a test — so no candidate-controlled text can reach a system message.

---

## Functions

| Function                       | Job                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `append_interview_turn`        | Writes both messages, the analysis and the session update **in one transaction**. Called on every turn.                                                     |
| `match_job_description_chunks` | pgvector similarity search, scoped by `auth.uid()`                                                                                                          |
| `record_llm_usage`             | Server-owned usage insert                                                                                                                                   |
| `update_session_progress`      | Server-owned progress update                                                                                                                                |
| `llm_usage_summary`            | Per-user cost rollup. Filters on `auth.uid()`, which is null for the `postgres` role — so it returns nothing from the SQL editor. Query the table directly. |
| `set_updated_at`               | Trigger function                                                                                                                                            |

**`append_interview_turn` is not optional.** `src/lib/db/sessions.ts` calls it on
every interview turn. Without migrations `0005` and `0006` the app builds and
deploys cleanly, then fails on the first message.

---

## Migrations

Run in numerical order. `0001`–`0010` are the original build; `0011` onward are
the production-review hardening.

| #                                         | Adds                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `0001_init`                               | personas, sessions, messages, RLS                                                      |
| `0002_job_descriptions`                   | JD storage, pgvector chunks, retrieval RPC                                             |
| `0003_table_privileges`                   | grants for the `authenticated` role                                                    |
| `0004_resumes`                            | resume storage                                                                         |
| `0005_atomic_turns_and_preset_uniqueness` | the atomic turn RPC, uniqueness constraints                                            |
| `0006_turn_analyses`                      | per-turn analysis persistence                                                          |
| `0007_llm_usage`                          | token accounting                                                                       |
| `0008_resume_profile`                     | distilled profile — **now unused**, see above                                          |
| `0009_session_columns`                    | `loop_id`, `loop_progress`, `launch_meta`, `competency_coverage` promoted out of JSONB |
| `0010_coach_answers`                      | cache for generated model answers                                                      |
| `0011_integrity_constraints`              | value checks moved from route handlers into the database                               |
| `0012_server_owned_writes`                | session and usage writes move behind `security definer`                                |
| `0013_job_description_metadata`           | JD company, source URL, notes                                                          |
| `0014_jd_clean_call_site`                 | the tidy-up call site in the usage vocabulary                                          |
| `0015_document_metadata`                  | resume label and notes, truncation records, the `resumes` `updated_at` trigger         |

---

## Personal data, and what happens to it

The tables hold two categories of genuinely personal data:

- **Resumes** — name, employment history, education, contact details if the
  candidate pasted them.
- **Interview transcripts** — everything the candidate said about their work,
  their failures and their colleagues, plus a score against each.

Both are covered by the same RLS rule as everything else, and both cascade on
account deletion. The product exposes two rights directly:

- **Export** — `GET /api/me/export` returns the user's own data as JSON.
- **Delete** — the settings page deletes interview history; account deletion
  cascades every table.

**What is not implemented:** there is no retention policy and no automatic
expiry. Data persists until the user deletes it. For a deployment handling real
candidates that would need stating in a privacy notice; for a final-year project
with consenting testers it is recorded here rather than claimed as solved.

**What is never stored:** the OpenAI and Azure keys stay server-side. The browser
receives only a short-lived Azure Speech token minted by `/api/speech-token`.
