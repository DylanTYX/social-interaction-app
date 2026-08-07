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
   and checkable — including the optimisation that provably does *not* fire.

---

## Pre-flight — do this the day before, not on the day

| # | Check | Command | Must see |
|---|---|---|---|
| 1 | **Node ≥20.9** | `node -v` | Not 18.x. Next 16 will not start on 18. `nvm install 20 && nvm use 20` |
| 2 | Dependencies | `npm ci` | clean install |
| 3 | Types, lint, tests | `npx tsc --noEmit && npm run lint && npm test` | 0, 0, all passing |
| 4 | Supabase reachable | `curl -s -o /dev/null -w "%{http_code}\n" $NEXT_PUBLIC_SUPABASE_URL/rest/v1/` | `401` (correct for an unauthenticated probe) |
| 5 | **Migrations `0001`–`0010` applied** | Supabase dashboard → SQL editor | `llm_usage` and `coach_answers` exist. Without `0007` there is no cost demo at all |
| 6 | OpenAI key has credit | `npm run eval -- --runs=1 --only=<one fixture>` | completes without a 429 |
| 7 | App starts | `npm run dev` | loads at `localhost:3000` |
| 8 | **Full dry run** | everything below, end to end | on the machine and network you will present from |
| 9 | Commit the artifacts | `npm run eval:persona > docs/artifacts/persona.txt` etc. | so every number has a fallback |

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

**What to say:** *"Same question, same answer, same round type. The only
variable is who is asking. The difficulty target the system sets for the next
question moves from 5 to 7 — and that is pure arithmetic, not a model call, so
it reproduces exactly every time."*

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
  a warm one score the same answer identically. Persona changes *what gets
  asked next*, not *what the answer was worth* — grading should not depend on
  who asked.

---

## Part 2 — Nationality, and why culture is not in the vector DB (3 min)

Expect this question. The answer is a design decision, not an omission.

`nationality` is biography — one adjective in one sentence, read nowhere else in
`src/`. `NATIONALITY_IS_BACKGROUND` sits immediately after it and instructs the
model never to infer directness, formality, deference or expectations from it.
A test asserts two personas differing only in nationality produce prompts that
differ by exactly the demonym.

**Why not a culture corpus in pgvector:**

1. **It is national-origin stereotyping with extra steps.** A retrieval store
   keyed on nationality returning behavioural claims makes the model generate
   behaviour *from national origin*, deterministically. That is what a
   stereotype is.
2. **It cannot be sourced at the granularity it needs.** Hofstede and GLOBE are
   *national aggregate* scores whose authors explicitly warn against applying
   them to individuals — the ecological fallacy. Using them to drive one
   interviewer's behaviour misapplies them exactly as cautioned.
3. **It is not needed.** Strictness, warmth, pace, pushback and style are
   explicit, controllable and measurable. They make the claim falsifiable.
   Nationality would make it arguable.

**The honest next step, if asked what you'd do instead:** interview *conventions*
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

| Demo | Do this | Then show |
|---|---|---|
| **The caching floor** | One session with no JD. Then one with a JD attached. | `npm run cost-report -- --session=<id>` for each. `cached_tokens` is **0** on the first, non-zero on the second. |
| **Trivial-answer skip** | Answer `ok`. Then answer properly. | Two `llm_usage` rows for the real answer (interviewer + analyzer); one for the trivial one. |
| **Coach-answer cache** | Generate a model answer on a report. Reload. Generate again. | A row the first time, **none** the second. |

**The caching one is the centrepiece, and it is a negative result.** The
interviewer's stable prefix on a bare session is ~590 tokens; OpenAI only caches
prefixes of 1,024+. So on a plain session caching does not fire at all, and the
report says so in words rather than leaving a zero to interpret.

**What to say:** *"The prompt is ordered so the constant part comes first and
the volatile part last. That ordering costs nothing when caching doesn't fire,
and it is the only thing that makes it possible when it does. On a bare session
it doesn't fire — and here is the measurement showing that, rather than a claim
that it does."*

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
description or CV is attached, which is exactly when the prompt is large enough
for it to matter. Padding the prompt to reach the floor would cost more than the
discount returns — the floor is not a target to game.

**"Why isn't the question bank in the vector DB?"**
Already answered in `docs/TOKEN-COST.md` under "Deliberately not done". RAG
saves tokens when it replaces stuffing a large corpus into the prompt — which is
why it *is* used for job descriptions, which run to 30,000 characters. The
interviewer prompt has no question corpus to slim down; questions are generated.
Retrieval would *add* ~60–150 input tokens per turn plus an embedding call. The
whole 39-question bank is ~800 tokens — the corpus is smaller than the machinery
needed to search it. There is a legitimate *quality* argument for a curated
bank; there is no cost argument.

---

## Where the numbers live

| Claim | Command | Doc |
|---|---|---|
| Personas differ | `npm run eval:persona` | this file |
| Scoring accuracy and stability | `npm run eval` | `docs/EVALUATION.md` |
| Cost, caching, per-turn spend | `npm run cost-report` | `docs/TOKEN-COST.md` |
| What is built | — | `docs/FEATURES.md` |
