# Token cost and prompt caching

Why the prompt is shaped the way it is, what each turn actually costs, and which
of these optimisations are _verified_ rather than _assumed_.

Written for whoever maintains this next — and to make the cost claims in this
project defensible rather than plausible.

---

## The rule this document follows

**Measure, don't estimate.** Every OpenAI response carries a `usage` block. This
app used to discard all of it, which meant no cost claim could be checked and no
optimisation could be shown to have worked. Every call site now records usage to
an `llm_usage` table, so the effect of a prompt change is a query, not an
argument.

Where a number below is measured, it says so. Where it is an estimate, it says
that too. **The estimates have not been validated against live traffic** — the
Supabase project has been unreachable throughout this work, so the `llm_usage`
table has never been queried with real rows in it. Treat every figure in the
"cost per turn" section as arithmetic, not evidence.

---

## What one turn costs

A single text turn makes up to four model calls:

| Call            | Model                    | When                       | Cap               |
| --------------- | ------------------------ | -------------------------- | ----------------- |
| Interviewer     | `gpt-4o-mini`            | Every turn                 | 320 output tokens |
| Analyzer        | `gpt-4o-mini`            | Every scored turn          | 900 output tokens |
| Summary refresh | `gpt-4o-mini`            | Every 4th message          | 400 output tokens |
| JD embedding    | `text-embedding-3-small` | Only on the retrieval path | —                 |

One block was deliberately _added_ to the volatile layer, against the general
direction of this document: the interviewer is now given the questions it has
already asked, verbatim. It costs roughly 20-120 input tokens per turn, growing
with the session and capped at ten questions.

That is a considered trade. The instruction not to repeat itself previously
pointed at the rolling summary, which keeps three turns intact and compresses
everything older into under 180 words — so by turn ten whether an earlier
question was still visible depended on what the summariser chose to keep, and
near-duplicate questions in the back half of a long session were likely with
nothing detecting them. A hundred input tokens is a cheaper fix than a larger
summary, and a much cheaper one than the interview repeating itself.

Two calls are deliberately skipped rather than optimised:

- **Trivial answers are not analysed.** An answer under 10 characters, one
  matching `yes / no / ok / ready / yep`, or the response timer's "no response"
  placeholder skips the analyzer entirely. Scoring "I'm ready" costs a full
  analyzer call and tells you nothing — and the placeholder, at 43 characters,
  used to clear the length floor and be scored as though the candidate had
  written it.
- **Small job descriptions never embed.** At four chunks or fewer, the top-k
  _is_ the whole document, so retrieval would pay an embedding call per turn to
  reassemble text that could have been sent once. Below that threshold the JD is
  inlined whole — which also moves it into the cacheable layer (see below), so
  the small-JD path is cheaper on _both_ counts.

Rough per-turn total, uncached: **~3,200 input / ~400 output** without a job
description, **~5,800 / ~400** with one. At `gpt-4o-mini` pricing that is
roughly $0.0007–0.0011 a turn, so a 10-question round costs about a cent.

That is small enough that the honest conclusion is: **cost was never the real
problem here.** The reason to do this work is that an unmeasured system can't be
reasoned about, and the things that _would_ hurt at scale — an uncapped analyzer,
a transcript read that grows linearly, a per-turn embedding call for a document
that fits in the prompt — were all present.

---

## Prompt caching: the mechanism, and its floor

OpenAI caches a prompt's **prefix** and charges a discount on the part served
from cache. Two properties drive everything below:

1. **It only caches prefixes of at least 1,024 tokens.** Below that, nothing is
   cached, no matter how repetitive the prompt is.
2. **The prefix must be byte-identical across calls**, and the cache is scoped
   per model. Change one character near the front, or switch models, and the
   whole prefix misses.

So the design goal is: _put everything constant at the front, everything that
changes at the back, and don't switch models mid-session._

### The stable / volatile split

`buildPromptLayers` in [route.ts](../src/app/api/chat/route.ts) emits two system
messages in a fixed order:

**Stable** — identical for every turn of a session, so it forms the cacheable
prefix:

- the static interviewer instructions (**measured: 832 chars, ~208 tokens**)
- the persona description
- the scenario context
- round-type guidance ("how to run this kind of round")
- the loop handover brief, if this is round 2+
- the candidate's CV, verbatim
- the hiring company, when the job description records one
- the job description **only when it was inlined whole**

**Volatile** — changes turn to turn, so it must come after:

- retrieved JD excerpts (different every turn by construction)
- the per-turn coaching signal from the analyzer
- the rolling conversation summary

The JD appears in _both_ lists deliberately. A whole inlined document is
identical on every turn and belongs in the prefix; retrieved excerpts are chosen
per question and would poison the prefix if placed there. Which list it lands in
is decided by `jobDescriptionIsStable`.

### One model for every interviewer turn

The opening turn used to run on `gpt-4o` for a stronger first impression, with
later turns on `gpt-4o-mini`. That is a cache bug wearing a quality costume: a
different model is a different cache, so turn 2 could never reuse turn 1's
prefix. The session paid the full prompt twice and got a cache hit neither time.

Now every interviewer turn uses one model. `INTERVIEWER_MODEL` still overrides it
if the quality trade turns out to be worth revisiting — but revisit it knowing
what it costs.

### `prompt_cache_key`

Both the interviewer and the analyzer pin a cache key, which helps OpenAI route
repeat requests to the same cache:

- interviewer: `sessionId:personaName:scenario:roundType`
- analyzer: `analyzer:<roundType>`

The analyzer's key is deliberately _not_ per-session. Its scaffold depends only
on the round type, so every user scoring a behavioural answer shares one prefix.

---

## The honest caveat: caching may not fire at all

This is the part worth stating plainly, because it is the sort of thing a viva
question goes straight to.

**The interviewer's stable prefix on a bare session is around 590 tokens** — 208
measured for the static instructions, plus roughly 325 for a persona, plus a
short scenario. That is **below the 1,024-token floor, so nothing is cached.**
The prefix only clears the bar once a job description or a resume is attached,
which is exactly when it grows past 1,000 tokens.

**The analyzer scaffold measures ~1,184 characters (~296 tokens)** before
interpolation. It is nowhere near the floor and, on its own, **almost certainly
never caches.**

So the accurate claim is not "this app uses prompt caching." It is:

> The prompt is _ordered_ so that caching engages whenever the prompt is large
> enough to be worth caching. On small prompts it does not fire — and on small
> prompts it does not matter, because those are the cheap turns.

The layering costs nothing when it doesn't fire, and is the only thing that makes
it possible when it does. That is the whole argument for it.

**None of this is confirmed against live traffic.** Confirming it means reading
`cached_tokens` after real sessions, which needs a reachable database. Do not
repeat the caching claim in a report without running the query in the next
section first.

---

## What else was fixed, and why

| Change                                         | Reasoning                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Analyzer capped at 900 output tokens**       | It ran unbounded on every scored turn. The full rubric JSON fits comfortably; without a cap a rambling model response was billed in full.                                                                                                                                                                                                                                    |
| **`finish_reason === "length"` checked**       | With a cap comes truncation. A truncated reply is _almost_ valid JSON, so it surfaced as a generic parse failure and the turn silently lost its score. It now names the real cause.                                                                                                                                                                                          |
| **`rawAnalysis` no longer stored or returned** | A verbatim duplicate of the entire analysis object was written to `interview_turn_analyses` and sent over the wire every turn, and read by nobody. It roughly doubled both the row and the response payload.                                                                                                                                                                 |
| **Transcript read bounded**                    | The chat route loaded the _entire_ transcript, then discarded all but the last few messages — growing linearly with session length and defeating the point of the rolling summary. It now reads a fixed window sized to cover the verbatim window, the prior-question lookup, and whatever aged out since the last summary refresh.                                          |
| **Rolling summary instead of full history**    | The last 6 messages go verbatim; everything older is folded into a compact summary regenerated every 4 messages. Cost stops growing with session length.                                                                                                                                                                                                                     |
| **Resume distillation, reversed**              | A CV *was* summarised into a 400-token profile at upload, and that profile — not the document — went into every prompt. It saved roughly 1,200 cached tokens a turn and cost the fidelity of the whole CV: the interviewer had never read a candidate's actual words, while its prompt label claimed otherwise. Removed. See "Why the CV is sent whole" below.                |
| **Similarity floor with a top-1 fallback**     | Chunks below 0.3 cosine similarity aren't worth the tokens, but the floor could remove _everything_, silently dropping role context from both the prompt and that turn's scoring. One weak excerpt beats no context and no signal.                                                                                                                                           |
| **Summary capped at 400 tokens**               | This was the last uncapped call, and the worst one to leave uncapped: the summary is regenerated _from itself_ and injected into every later prompt, so a single long generation inflated the rest of the session rather than costing once.                                                                                                                                  |
| **Counting moved out of the LLM**              | The analyzer asked the model for a word count, hesitation-marker count, qualifier count, revision count, metric count, and whether timeframes appear. Six pieces of arithmetic, billed in both the scaffold describing them and the response producing them, from a model with no reason to count accurately. Now `text-metrics.ts`; scaffold down from ~296 to ~245 tokens. |
| **Coach answers cached**                       | Generated model answers lived in React state only, so reopening a report regenerated all of them at full price for identical input. Now persisted per `(session_id, turn_index)` — see migration `0010`.                                                                                                                                                                     |
| **Three call sites instrumented**              | The coach route, the resume-profile distillation and the 12 competency probe embeddings recorded nothing, so every figure derived from `llm_usage` was an undercount.                                                                                                                                                                                                        |
| **Duplicate transcript fetch removed**         | Both interview screens fetched `/api/sessions/[id]/resume` twice on every load — the bootstrap hook took the launch config from the response and discarded the transcript, and a second hook re-fetched it.                                                                                                                                                                  |
| **Stream-failure retry made safe**             | On an SSE failure both screens re-POSTed the identical turn. The route persists _before_ emitting `done`, so a transport failure re-ran all 2-4 model calls and duplicated the answer. It now asks the server what it stored first.                                                                                                                                          |

---

## How to verify any of this

Every claim above is checkable against `llm_usage`. In the Supabase dashboard →
SQL Editor:

```sql
-- What does each component cost, and is caching hitting?
select call_site,
       count(*)                as calls,
       round(avg(prompt_tokens))     as avg_prompt,
       round(avg(cached_tokens))     as avg_cached,
       round(avg(completion_tokens)) as avg_completion
from llm_usage
group by call_site
order by avg_prompt desc;
```

`avg_cached` is the number that matters. **If it is 0 for `interviewer`, caching
is not firing** — most likely the prefix is under 1,024 tokens, which is expected
on sessions with no JD and no resume. Compare sessions with and without one:

```sql
-- Does attaching a JD or resume push the prefix over the caching floor?
select s.id,
       max(case when u.call_site = 'interviewer' then u.prompt_tokens end) as prompt_tokens,
       max(case when u.call_site = 'interviewer' then u.cached_tokens end) as cached_tokens
from llm_usage u
join interview_sessions s on s.id = u.session_id
group by s.id
order by prompt_tokens desc;
```

> The `llm_usage_summary` RPC returns nothing from the SQL editor. It filters on
> `auth.uid()`, which is null for the `postgres` role. Query the table directly.

To measure a prompt change: record the averages, deploy, run a few sessions, run
it again. That is the entire point of the table existing.

---

## Input caps, and why they reject rather than truncate

Three different things get called "capping", and only one of them can silently
lose data. Worth separating, because the risk is only in the first.

**Output caps (`max_tokens`) can truncate.** That risk is real and was already
being taken: the coach route capped at 700 for a 4-8 sentence model answer plus
a full rewrite plus four tips — roughly 550-710 tokens — so it sat on the
boundary, and with no `finish_reason` check a truncation surfaced as an
unparseable-JSON error that named the wrong cause.

The answer is not "don't cap" (uncapped is unbounded spend, and for the summary
it compounds). It is cap, detect, and degrade in whatever way suits the call:

| Call        | Cap   | On truncation                                                                                   |
| ----------- | ----- | ----------------------------------------------------------------------------------------------- |
| Summary     | 400   | Keep the **previous** summary. Never persist half a sentence that will feed every later prompt. |
| Analyzer    | 900   | Retry once at 1,600. Losing a turn's score leaves an unexplained gap in the report.             |
| Coach       | 1,000 | Clear error naming truncation.                                                                  |
| Interviewer | 320   | Log only — generous for the 2-5 sentences the prompt asks for.                                  |

Size these from **measured** `completion_tokens` p99 once there is live data,
not from the arithmetic above.

**Input caps do not truncate.** They reject with a 400 and a message naming the
field and both lengths. Halving a candidate's answer would score them on
something they did not say — a worse failure than an error. Limits live in
`src/lib/api/input-limits.ts` and sit far above real use: 10,000 characters is
roughly a twelve-minute monologue, so hitting one means a runaway client or an
attempt to run up the bill.

**Context bounding** — the 12-row transcript window and the rolling summary — is
designed compression, not truncation, and carries no such risk.

---

## Deliberately not done

- **A vector database of role-specific interview questions, retrieved per turn.**
  Suggested on the reasoning that RAG saves tokens. It does — when you would
  otherwise stuff a large corpus into the prompt. That is exactly why it is used
  for job descriptions, which are user-supplied and run to 30,000 characters.

  It does not apply here, because **the interviewer prompt contains no question
  corpus to slim down**. Questions are _generated_ from persona, scenario, JD and
  the candidate's last answer. Adding retrieval would not replace tokens, it
  would add them: roughly +60-150 input tokens per turn for the retrieved
  questions, plus an embedding call, against ~3,200 today.

  The best case is worse than it sounds. Serving a retrieved question verbatim
  and skipping generation entirely would save ~80 output tokens per turn —
  about **$0.000048 a turn, or $0.0005 for a ten-question session** — and would
  cost the adaptive questioning that is the whole contribution of the project.

  Scale makes the same point: the existing 39-question bank in
  `src/lib/question-bank.ts` is ~800 tokens in total. Retrieval earns its
  complexity when the corpus vastly exceeds the context budget; here you could
  inline the entire bank for less than one embedding call, and the drills page
  already selects from it with a plain array filter at zero cost.

  The _principle_ underneath the suggestion — retrieve what you already
  generated instead of generating it again — is sound, and it is applied where
  it actually pays: coach answers (migration `0010`) and JD embeddings
  (computed once).

  There is a legitimate **quality** argument for a curated bank — consistency,
  fewer off-role questions, and a measurable retrieval metric. It is just not a
  cost argument. The defensible version would retrieve two or three questions as
  _seed material_ only when competency coverage is low, and measure whether
  coverage improves.

- **Caching the analyzer across users via a larger scaffold.** Padding a prompt
  to reach 1,024 tokens so it qualifies for a cache discount costs more than the
  discount returns. The floor is not a target to game.
- **A cheaper analyzer model.** Scoring quality is the product. The eval harness
  (`npm run eval`) exists to measure whether a model change degrades band
  accuracy — make that change with evidence, not to save $0.0002 a turn.
- **Dropping the analyzer on some turns.** The steering loop depends on every
  substantive answer being scored; skipping turns would make the interviewer
  adapt to stale information. Only genuinely trivial answers are skipped.
- **An external vector database.** pgvector inside Supabase keeps retrieval under
  the same row-level security as every other table — the RPC filters on
  `auth.uid()` inside the database, which an external store could not do. Token
  cost was never the constraint that would justify losing that.
- **Fetching a job description from a pasted URL.** Proposed as a nicer
  alternative to pasting the text. It works on Greenhouse, Lever and most
  server-rendered careers pages, and fails on the three places most postings
  actually live: LinkedIn and Indeed put an auth wall and bot detection in front
  of it and prohibit it by terms of service, and Workday renders the posting
  client-side so the fetched HTML contains none of it. A feature that fails on
  the big names reads as broken rather than partial, and the fix for the Workday
  case is a headless browser that still would not get past LinkedIn.

  `POST /api/job-descriptions/clean` is the version that does work. The browser
  has already rendered the page, so pasting carries the text out of any source;
  the model's job is only to drop the furniture that comes with it.

### Why the CV is sent whole

The obvious optimisation here is the one that was tried and removed, so it is
worth writing down why rather than leaving the next person to rediscover it.

A CV sits in the **stable prefix**, so it is re-sent on every turn — but from
turn two onwards at the cached rate, and attaching one is a large part of what
pushes a session's prefix past the 1,024-token floor at all. A 24,000-character
CV works out at roughly **$0.005 for a ten-turn session**, against $0.0012 for
the 6,000-character clip it replaced. Three tenths of a cent.

What that bought previously was a `gpt-4o-mini` summary written at upload, which
the interviewer read **instead of** the document. Four losses stacked: only the
first 12,000 characters were summarised, the prompt instructed the model to
"drop everything else", the output was capped at 400 tokens with no
`finish_reason` check, and what survived was a paraphrase. Meanwhile the prompt
label told the interviewer this was the candidate's "actual background" and to
"never invent experience that isn't here" — so it could pressure-test a claim
the candidate never made, or refuse to explore real experience the summariser
had dropped.

Chunking the CV the way job descriptions are chunked was also considered and
rejected. Retrieval returns what is *similar* to the current conversation, not
what has *not been asked yet*, so it narrows rather than opens; the
"ask something new" job already belongs to `formatAskedQuestions` and the
competency coverage steer; and the retrieval path is `stable: false`, so it
would leave the cacheable prefix and be billed at full rate every turn.

The general lesson: a token optimisation that changes what the model *knows* is
not a token optimisation, it is a product change, and it should be priced as
one.

### The JD tidy-up is not a cost saving

Worth stating plainly, because it is the kind of change that gets justified with
the wrong number. Cleaning a posting costs roughly **$0.0009** and saves roughly
**$0.00002** of embedding — about thirty times more than it returns. Per-turn
prompt size does not move at all, because retrieval is hard-capped at four
chunks whether the document has four or forty.

What it buys is retrieval quality and latency:

- Boilerplate chunks compete for those four slots on **every turn of every
  session** using that JD. A seven-chunk posting where three chunks are EEO
  statement, benefits and "about us" is drawing four slots from a pool that is
  43% noise.
- Crossing below `SMALL_JD_CHUNK_LIMIT` (4) switches the JD to the inline path,
  which removes a per-turn embedding round-trip entirely and makes the context
  lossless rather than a top-4 gamble against `MIN_SIMILARITY`.

The cost is paid once at upload and amortised across every turn of every session
the JD is ever used in.

---

## Where the code lives

| Concern                                  | File                                         |
| ---------------------------------------- | -------------------------------------------- |
| Usage recording                          | `src/lib/api/token-usage.ts`                 |
| Usage table                              | `supabase/migrations/0007_llm_usage.sql`     |
| Prompt layering, cache key, model choice | `src/app/api/chat/route.ts`                  |
| Analyzer scaffold, cap, truncation check | `src/lib/response-analyzer.ts`               |
| Rolling summary cadence                  | `src/lib/summary.ts`                         |
| Similarity floor, small-JD inlining      | `src/lib/db/job-descriptions.ts`             |
| CV sent whole, and its one cap            | `src/lib/db/resumes.ts`                      |
| Over-length notice, shared by both docs   | `src/lib/document-truncation.ts`             |
| Deterministic text counting              | `src/lib/text-metrics.ts`                    |
| Input length caps                        | `src/lib/api/input-limits.ts`                |
| Coach answer cache                       | `supabase/migrations/0010_coach_answers.sql` |
| JD tidy-up (boilerplate stripping)       | `src/app/api/job-descriptions/clean/route.ts` |
