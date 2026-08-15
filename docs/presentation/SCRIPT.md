# FYP demo — talk track and runbook

Companion to `FYP-demo.pptx` — a five-slide deck. Section 1 is the talk, word for
word. Section 2 is the demo. Section 3 is question prep. Section 4 says where
every number on a slide came from.

The deck is 5 presented slides, then a "Thank you" card, then 6 appendix slides
that are **not** presented and exist only to answer questions.

The same two rules from [DEMO.md](../DEMO.md) apply to this deck:

1. **Never claim a number you have not run.**
2. **Lead with "it is measured", not "it is cheap."**

---

## ⚠️ Before anything else

```
node -v   →   v18.20.8          Next 16 requires >= 20.9
```

**`npm run dev` will not start on this machine as it stands.** Part 3 of the
demo — the live interview — is impossible until this is fixed:

```bash
nvm install 20 && nvm use 20
npm ci
npm run dev          # must load at localhost:3000
```

This is pre-flight item #1 in [DEMO.md](../DEMO.md). It also means the fixes in
commits `8d3a8e8` and `1181e6e` have never been exercised against a running app.
If asked "did you test that?", the honest answer for those two is: typecheck,
lint and unit tests — not a live run.

### Pre-flight, the day before — not on the day

| # | Check | Command | Must see |
|---|---|---|---|
| 1 | **Node ≥ 20.9** | `node -v` | not 18.x |
| 2 | Dependencies | `npm ci` | clean install |
| 3 | Types, lint, tests | `npx tsc --noEmit && npm run lint && npm test` | 0, 0, 299 passing |
| 4 | Supabase reachable | `curl -s -o /dev/null -w "%{http_code}\n" $NEXT_PUBLIC_SUPABASE_URL/rest/v1/` | `401` |
| 5 | Migrations `0001`–`0010` applied | Supabase SQL editor | `llm_usage` exists — without `0007` there is no cost demo |
| 6 | OpenAI key has credit | `npm run eval -- --runs=1 --only=<one fixture>` | completes, no 429 |
| 7 | App starts | `npm run dev` | loads at `localhost:3000` |
| 8 | **Full dry run** | everything in section 2 | on the machine and network you will present from |
| 9 | Artifacts committed | `npm run eval:persona > docs/artifacts/persona.txt` | so every number has a fallback |

Also fill in on slide 1: **your supervisor's name and the date**.

---

# Section 1 — the talk

**Five slides, 1025 words — about 6:50 at a rehearsed 150 wpm**
(nearer 6:13 if you speak quickly). The demo is the main event, so the talk stays lean.

These are the same words embedded as speaker notes in the `.pptx`. Both are
generated from the `SLIDES` array in `build-deck.mjs`, so they cannot drift apart.

**Slides 2, 3 and 4 carry the argument.** If you are running long, compress slide 1
(the problem is one line — say it once) and the closing half of slide 5.

---

### Slide 1 · What it is, and the gap — `0:00`

> Good morning. My final year project is ConvoTrainer, an interview practice
> application.
>
> All three ways of practising today have the same hole. A question bank asks
> the same things in the same order; it never notices that you dodged the
> question. A human adapts perfectly, but isn't available at eleven at night
> and can't be repeated ten times. A general chatbot will role-play, but won't
> grade you against a rubric or push back when you're weak. Nothing connects
> how you answered to what you get asked next. That loop is the project.
>
> So: you describe the role, optionally attaching the real job description and
> your CV, which are used to ground the questions. You pick the rounds and
> shape the interviewer. Then you interview.
>
> Six round types, each with its own rubric — a system design answer isn't
> judged the way a behavioural one is. Text or voice, with a code editor on
> technical rounds. Afterwards, a scored report with per-answer coaching,
> model answers and competency coverage.
>
> The rest of the slides are how that works underneath.

**Short: "Question banks don't adapt, humans don't scale, chatbots don't score. ConvoTrainer scores every answer and uses that score to pick the next question."**

---

### Slide 2 · How a turn works — `1:11`  ★

> This is the centre of the project — one turn, left to right.
>
> Your answer arrives at the chat endpoint. Before anything is generated, a
> second model call scores it against the rubric for that round type, at low
> temperature, returning JSON.
>
> That verdict goes into a decision engine — ordinary deterministic code, no
> model involved. It picks one of seven questioning strategies: probe the
> action, challenge ownership, drill for specificity. It also computes a
> difficulty target. Those become a private steering block inside the
> interviewer's prompt, which the candidate never sees. Then the next question
> streams back.
>
> Why that order? A verdict that only arrives at the end of the interview
> cannot change the interview. Scoring before generating is what makes the
> questioning adaptive rather than scripted.
>
> Three engineering points. Scoring is bounded at four seconds — I measured
> the turn before changing it, rather than guessing. Past that deadline the
> question starts unsteered, but the verdict is still collected and stored, so
> the transcript and the report are unaffected.
>
> Both messages and the analysis commit in one Postgres transaction, so a turn
> can't half-exist.
>
> And every interviewer turn runs on the same model. The opening turn used to
> use a stronger one — but a different model is a different prompt cache, so
> the session paid full price twice and hit cache neither time.

---

### Slide 3 · What I can prove — `2:41`  ★

> This is the claim I can prove, and the one I'd most like you to look at.
>
> The persona reaches the model down two paths. Textually, each dial becomes a
> sentence in the system prompt — and prompt text has no effect you can
> compute, so you have to measure what comes back.
>
> The numeric path is arithmetic: strictness minus warmth, over four, plus a
> repetition boost, clamped one to ten. That number is injected as an explicit
> instruction — aim for difficulty seven out of ten.
>
> On the right is real output. Identical question, identical answer, identical
> round type. The only variable is who's asking. Yuki, at strictness nine and
> warmth four, targets seven. Isabella, at warmth nine and pushback four,
> targets five.
>
> That isn't a sample from a stochastic model, it's a computation — you can do
> the arithmetic by hand and get the same two numbers, every run, offline. And
> a test fails if a future edit brings those two personas' dials together, so
> the comparison can't quietly stop demonstrating anything.
>
> Two limits, before you ask. The dials are coarse: strictness one to ten
> moves difficulty only five to seven. And scoring deliberately ignores
> persona — grading shouldn't depend on who asked.

---

### Slide 4 · What it costs — `4:03`  ★

> Second — I don't estimate what this costs. I measure it.
>
> Every OpenAI call records its token usage, including how much was served
> from cache, into a Postgres table as the call happens. A command-line tool
> reads that table and prices it, reporting tokens per call site, cache hit
> rate, and cost per turn. So any cost figure I give you is a query you can
> re-run.
>
> The most useful result was a negative one. OpenAI only caches a prompt
> prefix once it reaches 1,024 tokens. I'd deliberately structured the prompt
> in two layers — stable part first, volatile part last — specifically so
> caching could engage. Then I measured it: on a bare session the stable
> prefix is about 590 tokens. Under the floor. It never fires.
>
> I kept the structure, because it costs nothing and it's what makes caching
> possible once a job description is attached — which is when the prompt is
> big enough to matter. But the tool reports that it didn't fire, in words,
> rather than printing a zero I could quietly reinterpret.
>
> That's the claim I want to make. Not that this is cheap — a ten-question
> round is roughly a cent. It's that every model call is instrumented, priced
> and checkable, including the optimisation that provably doesn't work.

---

### Slide 5 · Status, limits, and the demo — `5:29`

> Finally, where it honestly stands.
>
> Built and verified: 299 unit tests across 31 files, all passing in CI on
> every push alongside typecheck and lint. Ten migrations with row-level
> security on every table — and retrieval runs through pgvector inside
> Postgres, so it inherits the same access rules as everything else.
>
> Built but not yet measured, and I'll be direct. I wrote an evaluation
> harness for scoring accuracy, with eighteen hand-authored fixtures and
> defined metrics. The results aren't collected yet — not because the harness
> doesn't work, but because every run is billed, and I wanted the metrics and
> the fixture set settled first so the first run is the real one rather than a
> pilot. Same for user acceptance testing: the plan, the handout and the exit
> criteria are written; no participants have been through it.
>
> Some things are deliberately out of scope — submitted code is reviewed,
> never executed, and it's English only.
>
> The rule I held to throughout: never claim a number I haven't run. That's
> why the middle column is on this slide rather than left off it.
>
> So, three things to show you, ordered by how much can go wrong. Starting
> with the one that can't fail.

**Short: "299 tests passing in CI, RLS everywhere, voice and text working. The eval harness and the UAT plan are written but not yet run — I'm not going to show you results I don't have."**

---

# Section 2 — the demo

Condensed from [DEMO.md](../DEMO.md), which has the long-form reasoning behind
each part. Lead with Part 1 because it is both the strongest evidence and the
only part that cannot fail.

Have two windows ready: a terminal with a large font, and a browser at
`localhost:3000` already logged in.

---

## Part 1 · Personas actually differ — 3 min · **cannot fail**

```bash
npm run eval:persona
```

No API calls, no network, byte-identical every run. Safe on stage.

It prints the instruction lines that differ between **Yuki Tanaka**
(strictness 9 · warmth 4 · pace 4 · pushback 9) and **Isabella Rodriguez**
(6 · 9 · 6 · 4), the follow-up difficulty each produces on the same candidate
answer — **7/10 vs 5/10** — and the difficulty curve as strictness sweeps 1→10.

> **Say:** "Same question, same answer, same round type. The only variable is who
> is asking. The difficulty target the system sets for the next question moves
> from five to seven — and that's pure arithmetic, not a model call, so it
> reproduces exactly every time."

**Why this pair, if asked:** chosen by inspection, not at random. Two personas
that are both `direct` at strictness 8 would differ by a single pace sentence
and prove nothing. A test fails if a future edit brings Yuki and Isabella's
dials together, so the comparison can't quietly stop demonstrating anything.

**Raise the caveats before you're asked:** the dials are coarse — strictness 5,
6 and 7 all emit "moderate standards", so those three prompts are byte-identical,
and the curve only moves 5→7 across the whole range. Both are pinned by tests, so
they're known and documented rather than discovered by your examiner.

**Fallback:** `docs/artifacts/persona-comparison.txt` — already committed.

---

## Part 2 · What it costs — 4 min · needs the database

```bash
npm run cost-report
npm run cost-report -- --session=<id>
```

Reads `llm_usage` with the service-role key and prints per-call-site tokens,
cache hit rate, cost per session and per turn, and the caching counterfactual.

Two things it does that the Supabase SQL editor cannot: the shipped
`llm_usage_summary` RPC filters on `auth.uid()`, which is null for the `postgres`
role, so it returns nothing when run by hand — and nothing else in the project
ever multiplies tokens by a rate. `src/lib/pricing.ts` is that multiplication,
and it returns `null` for an unknown model rather than `$0.00`, so an unpriced
model shows as unpriced instead of understating spend.

**The centrepiece is the negative result.**

> **Say:** "The prompt is ordered so the constant part comes first and the
> volatile part last. That ordering costs nothing when caching doesn't fire, and
> it's the only thing that makes it possible when it does. On a bare session it
> doesn't fire — and here is the measurement showing that, rather than a claim
> that it does."

Three savings you can show from row counts, if there's time:

| Demo | Do this | Then show |
|---|---|---|
| The caching floor | One session with no JD, one with a JD attached | `cached_tokens` is **0** on the first, non-zero on the second |
| Trivial-answer skip | Answer `ok`, then answer properly | Two `llm_usage` rows for the real answer, one for the trivial one |
| Coach-answer cache | Generate a model answer, reload, generate again | A row the first time, **none** the second |

**Fallback:** a saved `cost-report` run. Capture one during the dry run.

---

## Part 3 · A live interview — 6 min · needs Node ≥ 20.9

Short round, three questions. Pick the **strict** persona so the pushback is
visible. Then open the report and the cost figures for that session.

What to point at as it happens:

- the coaching rail updating after each answer — that's the analysis you saw on slide 4
- the interviewer escalating rather than moving on, when an answer is thin
- the report: score breakdown, per-answer coaching, model answers, competency coverage
- the calibration card — guess your own score before the reveal

**Fallback:** screenshots. Take them during the dry run.

> **If anything fails, say so plainly and switch.** A demo that admits a network
> failure and shows prepared evidence reads as prepared. One that stalls on a
> spinner does not.

---

# Section 3 — questions

### The three most likely

**"Why is scoring persona-blind?"**
Because grading shouldn't depend on who asked. An answer is worth what it's
worth. The persona controls the questioning strategy — what gets probed next and
how hard — which is where interviewer variation belongs. It also means the
analyzer's prompt prefix is shared across all users, which is the one place
caching has a real chance of firing.

**"Why doesn't caching fire?"**
The prefix is about 590 tokens and the floor is 1,024. It fires once a job
description or CV is attached, which is exactly when the prompt is large enough
for it to matter. Padding the prompt to reach the floor would cost more than the
discount returns — the floor isn't a target to game.

**"Why isn't the question bank in the vector database?"**
Retrieval saves tokens when it replaces stuffing a large corpus into the prompt —
which is why it *is* used for job descriptions, which run to 30,000 characters.
The interviewer prompt has no question corpus to slim down; questions are
generated. Retrieval would *add* 60–150 input tokens per turn plus an embedding
call, and the whole 39-question bank is about 800 tokens. The corpus is smaller
than the machinery needed to search it. There's a legitimate *quality* argument
for a curated bank; there's no cost argument.

### The ones slide 7 invites

**"Why haven't you run the evaluation?"**
It costs money per run and I wanted the methodology settled first — the metrics,
the band definitions, the fixture set — so that the first run is the real one
rather than a pilot. It's the top item on my next-steps list. What I won't do is
show you a number I haven't produced.

**"Then how do you know the scores are any good?"**
Right now I don't, and that's what the harness is for. What I *can* tell you is
what I did to make them measurable: the analyzer runs at low temperature for
stability, six countable fields were moved out of the model into deterministic
code so they can't be hallucinated, every judged field has a neutral default and
records which fields the model omitted, and the score bands deliberately overlap
so a borderline answer isn't forced into a false distinction.

**"Isn't this just a wrapper around GPT?"**
The model generates the questions, yes. It isn't the system. The scoring
pipeline, the decision engine that turns a score into a questioning strategy, the
deterministic difficulty computation, the retrieval and grounding, the
instrumentation, and the transaction guarantees are all mine — and the one claim
I can prove exactly is the part with no model in it at all.

**"Can users see the cost tooling?"**
Almost entirely no, and the exception is worth stating. The eval harnesses, the
cost report and the price table are excluded from the browser bundle by the
import graph *and* by an ESLint rule, so a future mistake fails CI. The
service-role key has no `NEXT_PUBLIC_` prefix, so it's undefined in a browser
either way. The honest exception: a logged-in user can read their *own* usage
rows through the API, because usage is written using their own session. They
can't read anyone else's, can't modify any, and can't derive cost. The absence of
a UI is not access control — the enforced boundaries are the import graph, the
key naming and RLS.

**"What's left to do?"**
Run the evaluation. Run the UAT. Run the blind-judge arm of the persona eval.
Then: move the rate limiter out of process so it's correct across serverless
instances, add a content security policy, and give usage recording a
service-role write path so the grant to authenticated users can be revoked.

---

# Section 4 — where every number on a slide came from

| Claim | Slide | Source |
|---|---|---|
| Six round types and their durations | 1 | `src/lib/round-types.ts` |
| Seven questioning strategies | 2 | `src/lib/decision-engine.ts` |
| Four-second scoring deadline | 2 | `STEER_DEADLINE_MS`, `src/app/api/chat/route.ts` |
| Single-transaction turn append | 2 | `append_interview_turn`, migration `0005` |
| The difficulty formula | 3 | `estimateFollowupDifficulty`, `src/lib/decision-engine.ts:304` |
| 7/10 vs 5/10, and the dials | 3 | `docs/artifacts/persona-comparison.txt` — committed output of `npm run eval:persona` |
| Strictness 1→10 moves difficulty 5→7 | 3 | same artifact, difficulty curve |
| 1,024-token cache floor, ~590-token prefix | 4 | `docs/TOKEN-COST.md`, `docs/DEMO.md` |
| ~1 cent per ten-question round | 4 (spoken) | `docs/TOKEN-COST.md` — **estimated, not yet validated against live traffic.** Say "roughly" or run `cost-report` first |
| 299 tests, 31 files | 5 | `npm test`, run 2026-08-10. **README.md still says 257 — it is stale** |
| 10 migrations, RLS on every table | 5 | `supabase/migrations/` |
| 18 eval fixtures, results pending | 5 | `src/eval/fixtures.ts`, `docs/EVALUATION.md` |
| 12 competencies | 1 | `src/lib/competencies.ts` |
| 39-question bank ≈ 800 tokens | Q&A | `docs/TOKEN-COST.md` |

**One number needs care.** The ~1 cent per round figure is labelled in
`docs/TOKEN-COST.md` as an estimate that has *not* been validated against live
traffic. In a talk whose thesis is "everything is measured", either run
`npm run cost-report` beforehand and quote the measured figure, or say the word
"estimated" out loud. Don't present it as a measurement.

---

## Rebuilding the deck

```bash
npm i pptxgenjs@4                      # anywhere; deliberately not a project dependency
node docs/presentation/build-deck.mjs  # rewrites FYP-demo.pptx
```

Speaker notes are embedded in the `.pptx`, so section 1 travels with the file.
If you edit the deck in PowerPoint, edit `build-deck.mjs` too or the next
rebuild will overwrite you.
