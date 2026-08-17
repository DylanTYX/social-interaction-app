# Demo runbook

For the live walkthrough: what to run, what to say, what each number means, and
what to fall back on when something fails.

Two rules underneath all of it:

1. **Never claim a number you have not run.** Every figure below comes from a
   command you can execute. If a command has not been run, its number is not in
   the talk track.
2. **Lead with "it is measured", not "it is cheap."** A ten-question round costs
   about a cent. Anyone who hears "we saved $0.0005 per session" will rightly
   push back. The contribution is that every model call is instrumented, priced
   and checkable — including the optimisation that provably does _not_ fire.

---

## How it works

Read this before the runbook. The commands below prove things; this is _what_
they prove and _why the proof holds_. Every claim ends at a file you can open.

### A. How a persona changes the interview

A persona reaches the model down **two independent paths**, and they are worth
separating because only one of them can be demonstrated without an API call.

```
PersonaConfig { strictness, warmth, pace, pushback, communicationStyle }
      │
      ├── TEXTUAL path ────────────────────────────────────────────────
      │     generatePersonaPrompt()                persona-engine.ts:154
      │     each dial → a sentence, by threshold (>=8 / >=5 / else)
      │          ↓
      │     stablePrompt, position 2               chat/route.ts:185-213
      │          ↓
      │     system message 1 of 2 → the model
      │
      │     Provable only by measuring the output. Prompt text has no
      │     effect you can compute; you have to look at what comes back.
      │
      └── NUMERIC path ────────────────────────────────────────────────
            DecisionContext { strictness, warmth }  chat/route.ts:664-672
                 ↓
            estimateFollowupDifficulty()          decision-engine.ts:291-316
            base + repetitionBoost + (strictness − warmth) / 4, clamped 1..10
                 ↓
            "Aim for difficulty N/10"               chat/route.ts:269
                 ↓
            injected back into the prompt as an explicit instruction

            Pure arithmetic. Reproduces exactly, every time, offline.
```

**This is the thing to lead with.** "Yuki 7/10, Isabella 5/10 on an identical
answer" is not a sample from a stochastic model — it is a computation. Your
examiner can read `estimateFollowupDifficulty`, do the arithmetic by hand, and
get the same number. That is a far stronger position than "look, the questions
feel different."

The textual path is what the empirical layer (`--live`) exists to measure, using
a blind judge, precisely because prompt text cannot be evaluated by inspection.

**What persona does _not_ touch:** scoring. `analyzeResponse` takes no persona
argument and its cache key is `analyzer:${roundType}`. Persona changes what gets
asked next; it never changes what an answer was worth.

### B. How prompt layering becomes a measured cost

```
OpenAI caches a prompt PREFIX of >=1024 tokens, byte-identical, per model
      ↓
buildPromptLayers() emits two system messages     chat/route.ts:159-232
   stable   → persona, scenario, round guidance, inlined JD, resume profile
   volatile → retrieved JD excerpts, coaching signal, rolling summary
      ↓
prompt_cache_key pins routing to the same cache   chat/route.ts:404
      ↓
the response carries usage.prompt_tokens_details.cached_tokens
   (streamed calls need stream_options.include_usage — chat/route.ts:401,
    otherwise the streaming path reports no usage at all)
      ↓
UsageCollector.record() … .flush()                token-usage.ts:51, 86
      ↓
one row per model call in llm_usage               migration 0007
      ↓
npm run cost-report → costOf() / costWithoutCaching()      pricing.ts
      ↓
dollars, cache hit rate, and the counterfactual
```

Two design consequences fall straight out of the mechanism, and both are good
answers to "why did you do it that way":

- **The JD appears in both layers, conditionally.** A small job description is
  inlined whole and identical every turn, so it belongs in the cacheable prefix.
  Retrieved excerpts differ per question, so putting them in the prefix would
  poison it. `jobDescriptionIsStable` decides which.
- **One model for every interviewer turn.** The opening turn used to run on a
  stronger model. A different model is a different cache, so turn 2 could never
  reuse turn 1's prefix — the session paid full price twice and hit cache
  neither time.

**The negative result is the strongest moment in the demo.** The stable prefix
on a bare session is ~590 tokens, under the 1,024 floor, so nothing caches at
all. `cost-report` says so in words rather than printing a zero for you to
interpret. The claim to make is not "this app uses prompt caching" — it is:

> The prompt is _ordered_ so caching engages whenever the prompt is large
> enough to be worth caching. On small prompts it does not fire, and on small
> prompts it does not matter. Here is the measurement telling you which case
> you are in.

### C. What counts as proof, strongest first

This ordering is itself part of the contribution — worth saying out loud.

|     | Kind of evidence                                      | Example here                                                                                                                                  |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Deterministic computation** — reproduces exactly    | `npm run eval:persona`, the difficulty numbers                                                                                                |
| 2   | **A test that fails when the claim stops being true** | `persona-engine.test.ts` fails if Yuki and Isabella's dials converge; `pricing.test.ts` fails if cached tokens are ever billed as extra input |
| 3   | **Measured rows, nothing sampled**                    | `llm_usage` — one row per model call                                                                                                          |
| 4   | **Blind measurement**                                 | the judge is never told which persona produced the text, so it cannot agree with the label                                                    |
| 5   | **Committed artifacts**                               | `docs/artifacts/`, so a network failure costs nothing                                                                                         |

Note what is _absent_: no claim rests on a single generated example, and no
figure in this document was estimated.

---

## Who can see what

Asked directly: are these tools reachable by end users? Almost entirely no — and
the exception is worth presenting rather than glossing.

| Concern                                                           | Where the boundary actually sits                                                                                            | Enforced?                                                                                                     |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The tooling (`eval`, `eval:persona`, `cost-report`, `pricing.ts`) | Import graph — nothing under `src/app`, `src/components`, `src/hooks` or `src/lib` imports them, so Next bundles none of it | Yes — now a lint rule (`eslint.config.mjs`), so a future import fails CI rather than silently shipping        |
| `SUPABASE_SERVICE_ROLE_KEY`                                       | One CLI script, no `NEXT_PUBLIC_` prefix                                                                                    | Yes — Next only inlines `NEXT_PUBLIC_*`, so it evaluates to `undefined` in a browser even if imported wrongly |
| Another user's data                                               | Row-level security on every table, `user_id = auth.uid()`                                                                   | Yes, in the database                                                                                          |
| `docs/` and `docs/artifacts/`                                     | Not in `public/`, no file-serving route, no rewrites                                                                        | Yes — no URL returns them                                                                                     |
| **A user's own `llm_usage` rows**                                 | **Nothing. The UI simply never renders them**                                                                               | **No**                                                                                                        |

**The last row, stated plainly.** Migration `0007` grants `select, insert` on
`llm_usage` to `authenticated`, and Supabase exposes every granted table over
PostgREST. A logged-in user can open devtools and read all of _their own_ usage
rows — model names, token counts, session ids — using the publishable key
already in their browser. They can also insert forged rows attributed to
themselves.

What they cannot do: read anyone else's rows (RLS blocks it), update or delete
any row (no grant), or derive dollar cost (the price table is not in the
browser).

**Why it is that way, and why it is a trade-off rather than an oversight:**
usage is written by the server using the _user's own_ cookie-bound session, not
a privileged one. Revoking `insert` from `authenticated` would stop recording
entirely. Fixing it properly means a service-role write path — real work, not
demo-blocking, and recorded here rather than discovered by someone else.

**The line to use if asked:** _"The absence of a UI is not access control. The
enforced boundaries are the import graph, the service-role key and RLS. A user
can see their own token counts if they go looking; they cannot see anyone
else's, and they cannot see what it cost."_

### Why each command is developer-only

| Command                | What stops an end user                                                             |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `npm run eval`         | Needs `OPENAI_API_KEY`; in no bundle; spends money                                 |
| `npm run eval:persona` | Same, plus it imports test-support fixtures                                        |
| `npm run cost-report`  | Needs `SUPABASE_SERVICE_ROLE_KEY`, which exists only in a developer's `.env.local` |

**No developer dashboard was built, deliberately.** The app has no admin or role
concept at all — every authenticated user is exactly equal — so a privileged
route would mean inventing the first one shortly before a demo, which is a new
auth surface to get wrong. The CLI is also better evidence: reproducible,
scriptable, and its output can be committed.

---

## Pre-flight — do this the day before, not on the day

| #   | Check                                | Command                                                                       | Must see                                                                           |
| --- | ------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **Node ≥20.9**                       | `node -v`                                                                     | Not 18.x. Next 16 will not start on 18. `nvm install 20 && nvm use 20`             |
| 2   | Dependencies                         | `npm ci`                                                                      | clean install                                                                      |
| 3   | Types, lint, tests                   | `npx tsc --noEmit && npm run lint && npm test`                                | 0, 0, all passing                                                                  |
| 4   | Supabase reachable                   | `curl -s -o /dev/null -w "%{http_code}\n" $NEXT_PUBLIC_SUPABASE_URL/rest/v1/` | `401` (correct for an unauthenticated probe)                                       |
| 5   | **Migrations `0001`–`0010` applied** | Supabase dashboard → SQL editor                                               | `llm_usage` and `coach_answers` exist. Without `0007` there is no cost demo at all |
| 6   | OpenAI key has credit                | `npm run eval -- --runs=1 --only=<one fixture>`                               | completes without a 429                                                            |
| 7   | App starts                           | `npm run dev`                                                                 | loads at `localhost:3000`                                                          |
| 8   | **Full dry run**                     | everything below, end to end                                                  | on the machine and network you will present from                                   |
| 9   | Commit the artifacts                 | `npm run eval:persona > docs/artifacts/persona.txt` etc.                      | so every number has a fallback                                                     |

---

## Part 1 — Personas actually differ (5 min)

### 1a. The deterministic proof — run this live, it cannot fail

```bash
npm run eval:persona
```

No API calls, no network, byte-identical every run. Safe on stage.

It prints, for **Yuki Tanaka** (analytical, strictness 9 / warmth 4 / pace 4 /
pushback 9) against **Isabella Rodriguez** (diplomatic, 6 / 9 / 6 / 4):

- the exact instruction lines that differ between the two system prompts
- the follow-up difficulty each produces **on the same candidate answer** — 7/10
  vs 5/10
- the difficulty curve as strictness sweeps 1→10

**Why this pair.** Chosen by inspection, not at random. Sarah Chen and Lars
Petersen would prove nothing — both `direct` at strictness 8, they differ in a
single pace sentence. A test (`persona-engine.test.ts`) fails if a future edit
brings Yuki and Isabella's dials together, so the comparison cannot quietly
stop demonstrating anything.

**What to say:** _"Same question, same answer, same round type. The only
variable is who is asking. The difficulty target the system sets for the next
question moves from 5 to 7 — and that is pure arithmetic, not a model call, so
it reproduces exactly every time."_

### 1b. The empirical proof — run beforehand, show the committed output

```bash
npm run eval:persona -- --live --runs=5
```

Generates five real follow-ups per persona on an identical input, then has a
**blind judge** — never told which persona produced the text — rate each for how
demanding it is. Reports mean, standard deviation and **separation**, the same
statistic `run-eval.ts` uses for strong-versus-weak answers.

Stochastic and billed, so run it in advance and show the file.

### Caveats to raise before you are asked

- **The dials are coarse.** Strictness 5, 6 and 7 all emit "moderate standards" —
  those three prompts are byte-identical. The difficulty curve compresses too:
  strictness 1→10 moves difficulty only 5→7. Both are pinned by tests, so they
  are known and documented rather than discovered by your examiner.
- **Scoring is persona-independent, deliberately.** `analyzeResponse` takes no
  persona and its cache key is `analyzer:${roundType}`. A strict interviewer and
  a warm one score the same answer identically. Persona changes _what gets
  asked next_, not _what the answer was worth_ — grading should not depend on
  who asked.

---

## Part 2 — Nationality, and why culture is not in the vector DB (3 min)

Expect this question. The answer is a design decision, not an omission, and it
is written up in full in
[DESIGN-DECISIONS.md §5](DESIGN-DECISIONS.md) — read that before the demo rather
than reconstructing it here. What to say out loud, in three beats:

1. **`nationality` is biography.** One adjective in one sentence, read nowhere
   else in `src/`. `NATIONALITY_IS_BACKGROUND` sits immediately after it and
   instructs the model never to infer directness, formality, deference or
   expectations from it. A test asserts two personas differing only in
   nationality produce prompts differing by exactly the demonym.
2. **A culture corpus would be stereotyping with extra steps.** A retrieval store
   keyed on nationality that returns behavioural claims makes the model generate
   behaviour _from national origin_, deterministically. And it cannot be sourced
   at the granularity it needs — Hofstede and GLOBE are national aggregates whose
   own authors warn against applying them to individuals.
3. **It is not needed.** Four explicit dials do the work, and they make the claim
   falsifiable — which is what `npm run eval:persona` then measures.

**The honest next step, if asked what you'd do instead:** interview _conventions_
by market — competency frameworks, self-introduction openers, case rounds —
keyed off the job description, cited to hiring guides, about **process** rather
than people. Defensible, sourceable, and genuinely useful to someone
interviewing abroad. Not built; scoped out on purpose.

---

## Part 3 — Token cost (7 min)

### 3a. What everything has cost

```bash
npm run cost-report
```

Reads `llm_usage` with the service-role key and prints per-call-site tokens,
cache hit rate, cost per session, cost per turn, and the caching counterfactual.

Two things it does that the Supabase SQL editor cannot: the shipped
`llm_usage_summary` RPC filters on `auth.uid()`, which is null for the
`postgres` role, so it returns nothing when run by hand — and nothing in this
project has ever multiplied tokens by a rate. `src/lib/pricing.ts` is that
multiplication, and it returns `null` for an unknown model rather than `$0.00`,
so an unpriced model shows as unpriced instead of understating spend.

### 3b. Three savings you can demonstrate, not model

Run each live. Each is provable from row counts, which is far stronger than a
before/after table built from traffic that never ran.

| Demo                    | Do this                                                      | Then show                                                                                                        |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **The caching floor**   | One session with no JD. Then one with a JD attached.         | `npm run cost-report -- --session=<id>` for each. `cached_tokens` is **0** on the first, non-zero on the second. |
| **Trivial-answer skip** | Answer `ok`. Then answer properly.                           | Two `llm_usage` rows for the real answer (interviewer + analyzer); one for the trivial one.                      |
| **Coach-answer cache**  | Generate a suggested answer on a report. Reload. Generate again. | A row the first time, **none** the second.                                                                       |

**The caching one is the centrepiece, and it is a negative result.** The
interviewer's stable prefix on a bare session is ~590 tokens; OpenAI only caches
prefixes of 1,024+. So on a plain session caching does not fire at all, and the
report says so in words rather than leaving a zero to interpret.

**What to say:** _"The prompt is ordered so the constant part comes first and
the volatile part last. That ordering costs nothing when caching doesn't fire,
and it is the only thing that makes it possible when it does. On a bare session
it doesn't fire — and here is the measurement showing that, rather than a claim
that it does."_

That is the strongest moment in the demo. It shows an optimisation being
honestly reported as inactive.

### 3c. What the eval harness costs

```bash
npm run eval
```

Now reports tokens and cost. Until recently it called `analyzeResponse` without
a `UsageCollector`, so every eval run was billed and recorded nothing — the one
tool built to measure the analyzer could not measure itself. Fixture traffic is
deliberately **not** flushed to `llm_usage`, so it never contaminates the real
per-session figures.

---

## Part 4 — One live interview (5 min)

Short round, three questions. Pick the strict persona so the pushback is
visible. Then open the report and the cost figures for that session.

**If anything fails**, switch to the committed artifacts and say so plainly.
A demo that admits a network failure and shows prepared evidence reads as
prepared; one that stalls on a spinner does not.

---

## The three questions most likely to come back

**"Why is scoring persona-blind?"**
Because grading should not depend on who asked. A candidate's answer is worth
what it is worth. Persona controls the questioning strategy — what gets probed
next and how hard — which is where interviewer variation belongs. It also means
the analyzer's prompt prefix is shared across all users, which is the one place
caching has a real chance of firing.

**"Why doesn't caching fire?"**
Because the prefix is ~590 tokens and the floor is 1,024. It fires once a job
description or resume is attached, which is exactly when the prompt is large enough
for it to matter. Padding the prompt to reach the floor would cost more than the
discount returns — the floor is not a target to game.

**"Why isn't the question bank in the vector DB?"**
Already answered in `docs/TOKEN-COST.md` under "Deliberately not done". RAG
saves tokens when it replaces stuffing a large corpus into the prompt — which is
why it _is_ used for job descriptions, which run to 30,000 characters. The
interviewer prompt has no question corpus to slim down; questions are generated.
Retrieval would _add_ ~60–150 input tokens per turn plus an embedding call. The
whole 39-question bank is ~800 tokens — the corpus is smaller than the machinery
needed to search it. There is a legitimate _quality_ argument for a curated
bank; there is no cost argument.

---

## Where the numbers live

| Claim                          | Command                | Doc                  |
| ------------------------------ | ---------------------- | -------------------- |
| Personas differ                | `npm run eval:persona` | this file            |
| Scoring accuracy and stability | `npm run eval`         | `docs/EVALUATION.md` |
| Cost, caching, per-turn spend  | `npm run cost-report`  | `docs/TOKEN-COST.md` |
| What is built                  | —                      | `docs/FEATURES.md`   |
