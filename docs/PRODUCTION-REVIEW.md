# Production review — what was fixed, and what was not

A full review of ConvoTrainer (184 source files, ~33.5k lines, 18 API routes)
covering correctness, security, edge cases, performance and integration. This
document records the outcome, and in particular the findings that were
**deliberately not fixed** — so they read as decisions with reasons rather than
as things nobody looked at. Two remain; five more were closed after a second
look showed the reasoning behind deferring them was weak.

**Deployment context: demo and assessment, not a public service.** That is load
bearing throughout. Several real findings are downgraded below because their
impact is confined to the account that triggers them, and there is no second
party to harm.

**Verification.** Everything below was checked against the source. From
`fa50c21` onwards the toolchain also runs a real `next build` — earlier work in
the sequence was verified by typecheck, lint and tests only, because the app
could not be built on the Node 18 that was on `PATH`. (Node 22 was available
under nvm the whole time; the build failure that suggested otherwise was a stale
`.next` cache.) Current state: `tsc` clean, lint clean apart from one
pre-existing warning in a docs script, **381 tests across 46 files**, production
build succeeds. Migrations `0011` and `0012` have since been applied.

---

## Fixed

Ten commits, in dependency order.

| Commit                | What                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `7652b1f`             | Three regressions from the turn-taking work, plus text-mode completion and the end-session race |
| `1dd5b35`             | Input bounds: PDF, JSON bodies, uploads, UUID validation, integrity migration                   |
| `26a42c1`             | Prompt-injection loop, turn-state guards, stream drain                                          |
| `95bd3fd`             | First-answer scoring, greeting recovery, session identity, duration                             |
| `4c293ee`             | Playback, privacy, fan-out, stale reads                                                         |
| `fa50c21` · `33c8802` | Toolchain, log hygiene, hook deduplication                                                      |
| `98c5a9c`             | Seven bugs that were reported but never fixed — timer, metrics, guards, resume, dashboard       |
| `1884627`             | Two payloads that were asserted rather than validated                                           |
| `24487f6`             | JSON responses read through the one helper that handles them                                    |
| `ad0a493`             | Four deferrals re-examined: grants, rate limits, error sink, unbounded reads                    |

The three worth singling out, because each was invisible rather than noisy:

- **Silence auto-submit corrupted every voice session.** The interval closed
  over a callback chain pinned to one render, so `applyTurn` always saw an empty
  analysis history: each auto-submitted turn discarded the previous ones, wrote
  its own raw score as the session average, and never reached the completion
  check. The Stop _button_ used the current render and was correct — which is
  precisely why manual testing never showed it.
- **Text mode never auto-completed.** `applyTurn`'s return was discarded where
  voice checks `isComplete`, while `applyTurn` still _persisted_ completion — so
  every later turn wrote another one with a fresh `endedAt`, and the sessions
  list showed a live interview as finished.
- **Text mode never scored its first answer.** The welcome message was written
  on the client and never persisted, so `findPriorQuestion` returned null on
  turn 1 and `shouldAnalyze` was false. The most prepared answer of the
  interview was unscored and absent from the report.

---

## Not fixed, with reasons

### 1. Rate limiting is still in-process

`src/lib/api/rate-limit.ts` keys on `user.id` and holds state in a module-level
map. All 18 routes are now covered — nine had no limit at all — but two
properties remain: registration is open, so N accounts are N× every limit, and
with more than one instance the limits multiply by instance count. There is no
global ceiling on OpenAI spend and no IP dimension.

**Not fixed** because the correct fix is a shared store — Redis, or a Postgres
table behind a `security definer` increment — which is infrastructure this
project does not have. For a single-instance demo with a known audience, the
per-user ceilings do the job.

### 2. The two document pages remain near-identical

`dashboard/resumes/page.tsx` and `dashboard/job-descriptions/page.tsx` are ~600
lines that differ, after normalising the noun, by ~110.

**Considered and declined.** The differences are domain, not accident: different
field names (`title` vs `roleTitle`), and different copy because the two
documents genuinely behave differently — a resume is stored as plain text, a job
description is chunked and embedded. A shared component would need the noun,
icon, accent, description, field label, placeholder, field name, hook and
explanatory copy as props: a template with ten holes, harder to read and to
change than two explicit files.

The half of that duplication which actually carried a _bug_ — three copies of
the list-fetch, each writing state after unmount and racing overlapping
refreshes — is deduplicated in `33c8802` as `useLibraryList`.

---

## Closed since the first pass

The first version of this document deferred five items. Asked why, four of them
did not survive re-examination: I had bundled a trivial fix inside an
infrastructure one and deferred both.

**Table grants** (`0012`, `ad0a493`). `authenticated` held `update` on
`interview_sessions` and `insert` on `llm_usage`, so a signed-in user could
write those tables directly through PostgREST and every check in the API layer
was advisory. Column-level grants cannot express the rule — the routes act
through the same role and JWT as the browser — but "through this function or not
at all" can be. `update_session_progress` and `record_llm_usage` are
`security definer` and re-check `user_id = auth.uid()` themselves;
`append_interview_turn` became `definer` for the same reason, since it writes
`turn_count`. The direct privileges are revoked. `select`, `insert` and `delete`
stay: it is mutation of an existing row that turns a validated record into an
arbitrary one.

**Client errors** (`ad0a493`). Deferred as "needs a vendor". It does not — the
boundaries now POST to `/api/client-errors`, which logs where every other server
failure already goes, so `error.digest` finally matches something.

**Unbounded reads and persona `kind`** (`ad0a493`). Both were one-liners.

---

## Full finding checklist

Every finding from the review, with where it ended up. Recorded as a checklist
because the first pass through this work silently dropped ten of them: they were
in the report, never fixed, and never listed as deferred.

| #   | Finding                                              | Status            |
| --- | ---------------------------------------------------- | ----------------- |
| 1   | Silence auto-submit pinned to one render             | `7652b1f`         |
| 2   | Both mic-reopen paths dead code                      | `7652b1f`         |
| 3   | Text mode never auto-completed                       | `7652b1f`         |
| 4   | End session raced an in-flight turn                  | `7652b1f`         |
| 5   | Deadline miss discarded the turn client-side         | `7652b1f`         |
| 6   | `usage.flush` lost when the turn threw               | `7652b1f`         |
| 7   | Unbounded PDF parsing                                | `1dd5b35`         |
| 8   | Chunked-upload size bypass                           | `1dd5b35`         |
| 9   | No JSON body limit on any route                      | `1dd5b35`         |
| 10  | No UUID validation anywhere                          | `1dd5b35`         |
| 11  | 14 routes flattened `ClientVisibleError` into 500    | `1dd5b35`         |
| 12  | `parseOffset` uncapped                               | `1dd5b35`         |
| 13  | Missing CHECK constraints and indexes                | `1dd5b35`         |
| 14  | Analyzer notes reached a system message unsanitized  | `26a42c1`         |
| 15  | Completed sessions still accepted turns              | `26a42c1`         |
| 16  | `mode: "opening"` replayable                         | `26a42c1`         |
| 17  | Stream drain had no deadline or lock release         | `26a42c1`         |
| 18  | Text mode never scored its first answer              | `95bd3fd`         |
| 19  | Failed greeting bricked the voice session            | `95bd3fd`         |
| 20  | Session identity always the pre-bootstrap default    | `95bd3fd`         |
| 21  | Resumed sessions undercounted duration               | `95bd3fd`         |
| 22  | Barge-in stranded the next turn's playback           | `4c293ee`         |
| 23  | Synthesis rejections unhandled                       | `4c293ee`         |
| 24  | "Speaking" state unreachable while speaking          | `4c293ee`         |
| 25  | Timeout placeholder scored as a real answer          | `4c293ee`         |
| 26  | Document text survived deletion                      | `4c293ee`         |
| 27  | `/api/me/export` 500-way fan-out                     | `4c293ee`         |
| 28  | `next-round` had no idempotency                      | `4c293ee`         |
| 29  | Sessions list showed stale filter results            | `4c293ee`         |
| 30  | Turn timing over-reported the analyzer ~7×           | `4c293ee`         |
| 31  | CI never built                                       | `fa50c21`         |
| 32  | No `engines` field                                   | `fa50c21`         |
| 33  | Vitest could not collect `.test.tsx`                 | `fa50c21`         |
| 34  | Two log sites carried user content                   | `fa50c21`         |
| 35  | Three library hooks duplicated, all racing           | `33c8802`         |
| 36  | Failed send could auto-submit the next answer        | `98c5a9c`         |
| 37  | Answer timer never stopped after expiry              | `98c5a9c`         |
| 38  | Resumed sessions recorded the wrong turn count       | `98c5a9c`         |
| 39  | Resume lost the interviewer's last decision          | `98c5a9c`         |
| 40  | `score-comparison` set state after unmount           | `98c5a9c`         |
| 41  | Lost update in the chat page                         | `98c5a9c`         |
| 42  | Dashboard confused "no JDs" with "failed to load"    | `98c5a9c`         |
| 43  | `voiceConfig` cast rather than validated             | `1884627`         |
| 44  | `coach_answers.turnIndex` unbounded                  | `1884627`         |
| 45  | 10 files hand-rolled JSON reading                    | `24487f6`         |
| 46  | Table grants make API validation advisory            | **deferred** (§1) |
| 47  | Rate limiting in-process, absent from 9 of 18 routes | **deferred** (§2) |
| 48  | No error reporting                                   | **deferred** (§3) |
| 49  | `listSessionsInLoop` / `listTurnAnalyses` unbounded  | **deferred** (§4) |
| 50  | Persona `kind` client-settable                       | **deferred** (§5) |
| 51  | Two document pages near-identical                    | **declined** (§6) |

---

## Verified correct — do not "fix" these

Checked and found sound, recorded so the next review does not re-litigate them:

- **Authentication and RLS.** All 24 API handlers authenticate and 401. RLS is
  enabled with a matching policy on all nine tables; no `anon` grants.
- **XSS surface is closed.** No `dangerouslySetInnerHTML`, no `rehype-raw`, no
  `innerHTML` anywhere. Markdown renders through `react-markdown` with
  `remarkGfm`/`remarkBreaks` only.
- **No secret can reach the browser.** Only three `NEXT_PUBLIC_*` variables
  exist and all three are the intended-public Supabase URL and anon key.
  `AZURE_SPEECH_KEY` appears only in the token-minting route (the correct
  short-lived-token pattern); the service-role key appears only in an eval
  script, never in the app.
- **Server-side persona validation.** `parsePersonaConfig` clamps dials to 1–10,
  truncates strings and caps list lengths, so a corrupted client config cannot
  reach the prompt or the database.
- **Type discipline.** Zero `any`, zero `@ts-ignore`, zero `@ts-expect-error`,
  zero non-null assertions under `strict`. Zero TODO/FIXME markers.
- **Empty and first-run states.** No divide-by-zero, no indexing into an empty
  array, no NaN reaching the DOM across the dashboard.
- **`append_interview_turn`** is genuinely atomic and correctly used.
- **Persona nationality** is explicitly biographical-only in the prompt
  (`NATIONALITY_IS_BACKGROUND` in `persona-engine.ts`), never a behavioural
  driver. It does select the TTS accent, on the audio path only —
  `persona-engine.ts` does not import `persona-voice.ts`, and tests assert the
  prompt is byte-identical across voice settings. See DESIGN-DECISIONS §5a.
- **Voice names are resolved against a catalogue** before reaching Azure
  (`resolveKnownVoiceUri`). Previously `launch_meta.voiceConfig.selectedVoiceUri`
  was only length-capped and was interpolated unescaped into the SSML
  `<voice name="…">` attribute, so a crafted value could inject elements.

---

## Known limits of this review

- No runtime exercise of a full interview. The build compiles and the unit tests
  pass; nobody has driven a voice session end to end against live Azure and
  OpenAI since these changes.
- No load testing. The performance findings are read from the code — query
  shapes, fan-out widths, index coverage — not measured.
- **`0011`'s constraints are `not valid`**, so existing rows stay unchecked
  until someone runs `validate constraint`. New and updated rows are checked. A
  database set up from the consolidated migrations validates them at creation.
- **The `0012` RPC path is unit-tested but not yet exercised end to end here.**
  `updateSession` and `UsageCollector.flush` have tests asserting they call
  `update_session_progress` / `record_llm_usage` with the right shape, so a
  drift in the function name or arguments fails loudly — but no full interview
  has round-tripped through them in this environment.
- The `[turn-timing]` numbers that would settle whether the analyzer is worth
  splitting have still not been read from a real session.
