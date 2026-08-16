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

The shell defaults to Node 18, on which **`npm run dev` will not start** — so the
live-interview part of the demo is impossible. Node 22 is already installed, so
this is one command, not an install:

```bash
nvm use 22           # or: nvm alias default 22
npm ci
npm run dev          # must load at localhost:3000
```

On Node 18 the test suite also reports 3 unhandled errors (a jsdom/ESM
incompatibility in the environment, not a test failure). On Node 22 it is
**482 tests across 55 files, all passing, zero errors** — that is the number on
slide 3, and the version to quote it from.

### Pre-flight, the day before — not on the day

| # | Check | Command | Must see |
|---|---|---|---|
| 1 | **Node ≥ 20.9** | `nvm use 22 && node -v` | not 18.x |
| 2 | Dependencies | `npm ci` | clean install |
| 3 | Types, lint, tests | `npx tsc --noEmit && npm run lint && npm test` | 0, 0, **482 passing, 0 errors** |
| 4 | Supabase reachable | `curl -s -o /dev/null -w "%{http_code}\n" $NEXT_PUBLIC_SUPABASE_URL/rest/v1/` | `401` |
| 5 | Migrations `0001`–`0015` applied | Supabase SQL editor | usage table exists — without `0007` there is no cost demo; `0012` moves usage writes server-side |
| 6 | OpenAI key has credit | `npm run eval -- --runs=1 --only=<one fixture>` | completes, no 429 |
| 7 | App starts | `npm run dev` | loads at `localhost:3000` |
| 8 | **Full dry run** | everything in section 2 | on the machine and network you will present from |
| 9 | Artifacts committed | `npm run eval:persona > docs/artifacts/persona.txt` | so every number has a fallback |

Also fill in on slide 1: **your supervisor's name and the date**.

---

# Section 1 — the talk

**Five slides, 1177 words — about 7:51 at a rehearsed 150 wpm**
(nearer 7:08 if you speak quickly). The demo is the main event, so the talk stays lean.

These are the same words embedded as speaker notes in the `.pptx`. Both are
generated from the `SLIDES` array in `build-deck.mjs`, so they cannot drift apart.

**Slides 2, 3 and 4 carry the argument.** If you are running long, compress slide 1
(the problem is one line — say it once) and the closing half of slide 5.

---

### Slide 1 · What it is, and what's built — `0:00`

> Good morning. My final year project is ConvoTrainer, an interview practice
> application.
>
> All three ways of practising today have the same hole. A question bank asks
> the same things in the same order; it never notices you dodged the question.
> A human adapts perfectly, but isn't available at eleven at night. A general
> chatbot will role-play, but won't grade you against a rubric or push back
> when you're weak. Nothing connects how you answered to what you get asked
> next. That loop is the project.
>
> You describe the role, optionally attaching the real job description and
> your resume to ground the questions. You pick the rounds, shape the interviewer,
> and interview.
>
> Six round types, each judged on its own rubric — a system design answer
> isn't assessed the way a behavioural one is. Text or voice, with a code
> editor on technical rounds. Afterwards, a scored report with per-answer
> coaching, model answers and competency coverage.
>
> The remaining four slides are how that works underneath.

**Short: "Question banks don't adapt, humans don't scale, chatbots don't score. ConvoTrainer scores every answer and uses that score to choose the next question."**

---

### Slide 2 · How one turn works — `1:06`  ★

> This is the shape of a single turn, left to right.
>
> Your answer arrives at the server. Before any question is generated, a
> second model call scores that answer against the rubric for the round you're
> in.
>
> The verdict goes into a decision engine — ordinary deterministic code, no
> model involved. It chooses how to question you next and sets a difficulty
> target. That becomes a private instruction attached to the interviewer's
> prompt, which you never see. Then the next question streams back.
>
> Why that order? A verdict that only arrives at the end of the interview
> cannot change the interview. Scoring before generating is what makes the
> questioning adaptive rather than scripted.
>
> Two engineering points. Scoring is bounded at four seconds, so a slow scorer
> never leaves you staring at a blank screen — past the deadline the question
> is generated unsteered, but the score is still recorded. And both messages
> and the score are written in one database transaction, so a turn can't
> half-exist.
>
> One thing to be clear about, because the word gets used loosely: this is not
> an agent. There are no tools for the model to call and no autonomous
> planning. The model generates; the code decides — and that is what makes a
> run reproducible.

---

### Slide 3 · What it's built on — `2:30`

> What it's built on, in four parts.
>
> Language models: one model, GPT-4o-mini, does the interviewing, the scoring,
> the summarising and the coaching. It's called over plain HTTPS — no SDK, no
> agent framework. Replies stream token by token; scoring runs at low
> temperature and returns structured JSON so it's repeatable.
>
> Speech: Azure AI Speech in both directions — continuous speech-to-text while
> you talk, neural voices for the interviewer. It speaks sentence by sentence
> while the reply is still being written. The Azure key never reaches the
> browser; the page asks my server for a nine-minute token instead.
>
> Grounding: a job description is uploaded or pasted, cleaned up, split into
> overlapping chunks, embedded, and stored as vectors in Postgres using
> pgvector. Each turn retrieves the most relevant passages. Short documents
> skip all that and go in whole, because retrieval would cost more than it
> saves. The resume is read directly.
>
> Data: Supabase Postgres, fifteen migrations, row-level security on all nine
> tables.
>
> The decision worth defending is the third one. Search lives inside the
> database, so it inherits the same per-user access rules as every other
> table. A separate vector database would have been a second place to get
> authorisation right.
>
> Continuous integration runs typecheck, lint, four hundred and eighty-two
> tests and a production build on every push. The deployment runbook is
> written, but I have not deployed yet.

---

### Slide 4 · Token usage and cost control — `4:01`  ★

> I don't estimate what this costs. I measure it.
>
> Every model call records its own token usage, including how much was served
> from cache, as it happens. A reporting tool prices that — tokens per call
> site, cache hit rate, cost per turn. So any cost figure I give you is a
> query you can re-run, not a number I worked out on paper.
>
> Several things got cut once I could see where the tokens went. Trivial
> answers like "ok" skip scoring entirely. Anything countable — word count,
> hedging, whether you gave a metric — is computed in plain code instead of
> asked of the model, because counting isn't judgement and a model has no
> reason to count accurately. Coaching answers are cached, and a rolling
> summary replaces resending the transcript.
>
> The most useful result was a negative one. The provider only caches a prompt
> prefix once it reaches one thousand and twenty-four tokens. I'd deliberately
> ordered the prompt with the unchanging part first, so caching could engage.
> Then I measured it: on a plain session that stable part is about five
> hundred and ninety tokens. Under the floor. It never fires.
>
> I kept the ordering, because it costs nothing and it's what makes caching
> work once a job description is attached — which is when the prompt is big
> enough to matter. But the tool reports that it didn't fire, in words, rather
> than printing a zero I could quietly reinterpret.
>
> So the claim isn't that this is cheap. It's that every call is instrumented
> and checkable, including the optimisation that provably doesn't work.

---

### Slide 5 · How it decides, and what you control — `5:47`  ★

> Last slide: what's inside the two decision boxes, and what you can change.
>
> Scoring first. The rubric is chosen by round type — a behavioural answer is
> judged on situation, task, action and result; a technical one on problem
> framing, correctness, complexity, edge cases and code quality. It runs at
> low temperature and returns structured JSON, so the same answer doesn't
> swing between runs. Anything countable is computed in code rather than asked
> of the model. If the model leaves a field out, it gets a neutral default and
> the omission is recorded — never silently zero. And scoring never sees the
> persona, because grading shouldn't depend on who asked.
>
> Choosing the next question is a fixed ladder over those scores. Didn't set
> the scene? It clarifies. Vague answer? It drills for specifics. Said "we"
> instead of "I"? It challenges ownership. Seven strategies, first match wins.
> Ask the same way twice and it escalates and raises the difficulty. It also
> steers toward competencies you haven't covered yet, and it's given its last
> ten questions with instructions not to repeat them.
>
> What you control is the third column: the rounds and their length, the
> interviewer's background and four dials, text or voice, and your real
> documents.
>
> I want to be precise about the boundary. The surface is configurable; the
> decision core is not. Only strictness and warmth feed those calculations —
> every threshold is fixed. That's deliberate: it's why a run is reproducible
> and unit-testable.
>
> And here's what that buys. Same question, same answer, only the interviewer
> differs — the difficulty target moves from five to seven. Not a sample from
> a stochastic model: a computation that reproduces exactly, offline, every
> run.
>
> One confound I'll state before you're asked: a warmer interviewer sets
> easier questions, so scores aren't comparable across personas. The system
> knows that and says so in the interface.

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
description or resume is attached, which is exactly when the prompt is large enough
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

### The ones the status strip invites

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
Almost entirely no. The eval harnesses, the cost report and the price table are
excluded from the browser bundle by the import graph *and* by an ESLint rule, so
a future mistake fails CI. The service-role key has no `NEXT_PUBLIC_` prefix, so
it's undefined in a browser either way. Usage rows are now written server-side
and attributed to the authenticated user, so they can't be forged — an earlier
version recorded them under the user's own session, which made the numbers
forgeable by the person they described. A user can still read their own token
counts if they go looking; they can't read anyone else's, can't modify any, and
can't derive cost, because the price table never reaches the browser.

**"What's left to do?"**
Run the scoring evaluation. Run the user testing. Run the blind-judge arm of the
persona study. Deploy it. Then move the rate limiter out of process so it's
correct across more than one instance, and add a content security policy.

### The one to be ready for

**"Is it agentic?"**
No, and I'd rather say so than let the word do work it can't. There are no tool
definitions, no function calling, and no autonomous planning — five single-shot
model calls and a hand-written decision ladder. The model generates text and
JSON; the code decides what happens next.

That's a deliberate choice, not a missing feature. Because the control flow is
ordinary code, a run is reproducible, every branch is unit-tested, and I can
show you the difficulty target being computed rather than sampled. An agent
choosing its own thresholds would give up all three. The accurate description is
**a deterministic control loop with a language model inside it**.

**"So how much is really configurable?"**
Be precise here, because the honest answer is stronger than the flattering one.
The *surface* is broad: six round types, length, focus, multi-round loops, the
interviewer's background and four dials, text or voice, six voices, your own
documents. The *decision core* is not configurable — only strictness and warmth
feed those calculations, and every threshold is a fixed constant. That's what
makes it reproducible.

If pressed on the weakest link: the round-length slider sets a planning value,
and the per-answer countdown is a separate fixed constant. They aren't wired
together yet.

---

# Section 4 — where every number on a slide came from

| Claim | Slide | Source |
|---|---|---|
| Six round types, each with its own rubric | 1 | `src/lib/round-types.ts` |
| Seven questioning strategies, and the ladder that picks one | 5 | `src/lib/decision-engine.ts` |
| Four-second scoring bound | 2 | `STEER_DEADLINE_MS`, `src/app/api/chat/route.ts` |
| Single-transaction turn append | 2 | `append_interview_turn`, migration `0005` |
| The difficulty formula | 5 (appendix) | `estimateFollowupDifficulty`, `src/lib/decision-engine.ts:304` |
| Difficulty 5 vs 7 on the same answer | 5 | `docs/artifacts/persona-comparison.txt` — committed output of `npm run eval:persona` |
| Rubric fields per round family | 5 | `src/lib/response-analyzer.ts`, `src/lib/round-types.ts` |
| 1,024-token cache floor, ~590-token prefix | 4 | `docs/TOKEN-COST.md`, `docs/DEMO.md` |
| ~1 cent per ten-question round | 4 (spoken) | `docs/TOKEN-COST.md` — **estimated, not yet validated against live traffic.** Say "roughly" or run `cost-report` first |
| 482 tests, 55 files, all passing | 3 | `npm test` on Node 22. **README.md still says 257 — it is stale** |
| 15 migrations, RLS on all 9 tables | 3 | `supabase/migrations/` |
| Scoring study and UAT designed, not run | 3 | `src/eval/fixtures.ts`, `docs/EVALUATION.md`, `docs/UAT.md` |
| 12 competencies, coverage steer | 1, 5 | `src/lib/competencies.ts`, `src/lib/competency-matching.ts` |
| 39-question bank ≈ 800 tokens | Q&A | `docs/TOKEN-COST.md` |
| Chunking: 1,200 chars / 180 overlap, 1536-d | 3 | `src/lib/jd-chunking.ts`, `src/lib/embeddings.ts` |
| 9-minute Azure speech token | 3 | `src/app/api/speech-token/route.ts` |
| Four dials, 1–10 | 5 | `src/lib/persona-schema.ts`, `src/components/setup/persona-step.tsx` |
| Not deployed | 3 | no `vercel.json`, no `.vercel/`, no deploy job in `.github/workflows/ci.yml` |

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
