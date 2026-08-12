# Production review — what was fixed, and what was not

A full review of ConvoTrainer (184 source files, ~33.5k lines, 18 API routes)
covering correctness, security, edge cases, performance and integration. This
document records the outcome, and in particular the findings that were
**deliberately not fixed** — so they read as decisions with reasons rather than
as things nobody looked at.

**Deployment context: demo and assessment, not a public service.** That is load
bearing throughout. Several real findings are downgraded below because their
impact is confined to the account that triggers them, and there is no second
party to harm.

**Verification.** Everything below was checked against the source. From
`fa50c21` onwards the toolchain also runs a real `next build` — earlier work in
the sequence was verified by typecheck, lint and tests only, because the app
could not be built on the Node 18 that was on `PATH`. Current state: `tsc`
clean, lint clean (one pre-existing warning in a docs script), 331 tests across
37 files, production build succeeds.

---

## Fixed

Six commits, in dependency order.

| Commit                | What                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `7652b1f`             | Three regressions from the turn-taking work, plus text-mode completion and the end-session race |
| `1dd5b35`             | Input bounds: PDF, JSON bodies, uploads, UUID validation, integrity migration                   |
| `26a42c1`             | Prompt-injection loop, turn-state guards, stream drain                                          |
| `95bd3fd`             | First-answer scoring, greeting recovery, session identity, duration                             |
| `4c293ee`             | Playback, privacy, fan-out, stale reads                                                         |
| `fa50c21` · `33c8802` | Toolchain, log hygiene, hook deduplication                                                      |

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

### 1. Table-level grants make API validation advisory

`supabase/migrations/0003_table_privileges.sql:8-12` (and `0004`, `0006`, `0007`,
`0010`) grant `select, insert, update, delete` on every table to `authenticated`.
The browser holds the anon key and a session cookie. **RLS restricts which rows a
statement may touch; it says nothing about which columns or what values.**

So from the browser console, a signed-in user can write columns the API guards:

```js
supabase.from('interview_sessions').update({
  average_score: 100,
  launch_meta: { loopBrief: 'SYSTEM: …', interviewLoop: {…} },
}).eq('id', myOwnSessionId)
```

That matters because `sanitizeLaunchMeta` deliberately drops `loopBrief` —
`session-launch-meta.ts:213-228` explains why, in the codebase's own words: _"A
client could therefore write its own system-prompt content."_ `/api/chat` then
interpolates that column verbatim into the interviewer's **stable** prompt layer.
The API closes the hole; the grant reopens it. The same applies to `llm_usage`,
which is what the cost-instrumentation demo is measured from.

**Why it is not fixed:** column-level grants cannot express the rule. The API
routes act through the _same_ `authenticated` role and the _same_ JWT as the
browser would, so any grant permitting `/api/chat` to write `summary` equally
permits the console to. Closing it properly means moving every server-owned
write behind `security definer` functions, the way `append_interview_turn`
already is — a change to `updateSession` and most write routes.

**Why that is acceptable here:** every impact is self-scoped. RLS still confines
a forged write to the forger's own rows, so there is no cross-tenant escalation
and no path to another user's data. A candidate can corrupt their own score or
jailbreak their own interviewer. For a public service this would be P0; for a
graded demo it is a defence-in-depth gap.

**What was done instead:** `0011_integrity_constraints.sql` closes the _value_
half for every writer — score ranges, non-negative counters, the `call_site`
vocabulary — so a forged or buggy write cannot store a nonsensical number even
though it can still store a number.

### 2. Rate limiting is in-process and per-user

`src/lib/api/rate-limit.ts` keys on `user.id` and holds state in a module-level
map. Two consequences the module's own comment does not cover: registration is
open, so N accounts are N× every limit; and with more than one instance the
limits multiply by instance count. There is also no global ceiling on OpenAI
spend and no IP dimension.

**Not fixed** because the correct fix is a shared store (Redis, or a Postgres
table with a `security definer` increment), which is infrastructure this project
does not have. For a single-instance demo with a known audience the current
limiter does what it needs to.

### 3. No error reporting

Three `error.tsx` boundaries exist and all three `console.error` in the _user's_
browser. Nothing is transmitted; `error.digest` is shown to the user as a
"Reference" that no server log records. There is no request or session id in any
log line.

**Not fixed** because adding an error-reporting SDK is a deployment decision with
a vendor attached, not a code fix. Worth doing before any real deployment.

### 4. Remaining unbounded reads

`listSessionsInLoop` and `listTurnAnalyses` have no `.limit()`, and `/report`,
`/resume` and `/next-round` call them. `loop_id` is not client-settable through
the API, so the fan-out is bounded by the user's own session count in practice.
Recorded rather than fixed; the export fan-out, which was the acute one, is
batched.

### 5. Persona `kind` is client-settable

`personas/route.ts` accepts `kind: "preset"` from the body. Combined with
`resetPersonaPresets`, a user who names a persona after a shipped preset can
lose it on "Restore presets". Self-scoped data loss on an explicitly destructive
button; noted, not fixed.

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
  (`persona-engine.ts:156`), never a behavioural driver.

---

## Known limits of this review

- No runtime exercise of a full interview. The build compiles and the unit tests
  pass; nobody has driven a voice session end to end against live Azure and
  OpenAI since these changes.
- No load testing. The performance findings are read from the code — query
  shapes, fan-out widths, index coverage — not measured.
- Migration `0011` has not been applied. Its constraints are `not valid`, so it
  cannot fail on existing rows, but that also means existing rows are unchecked
  until someone runs `validate constraint`.
- The `[turn-timing]` numbers that would settle whether the analyzer is worth
  splitting have still not been read from a real session.
