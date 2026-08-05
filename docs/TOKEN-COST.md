# Token cost and prompt caching

Why the prompt is shaped the way it is, what each turn actually costs, and which
of these optimisations are *verified* rather than *assumed*.

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

| Call | Model | When | Cap |
|---|---|---|---|
| Interviewer | `gpt-4o-mini` | Every turn | 320 output tokens |
| Analyzer | `gpt-4o-mini` | Every scored turn | 900 output tokens |
| Summary refresh | `gpt-4o-mini` | Every 4th message | — |
| JD embedding | `text-embedding-3-small` | Only on the retrieval path | — |

Two of those are deliberately skipped rather than optimised:

- **Trivial answers are not analysed.** An answer under 10 characters, or one
  matching `yes / no / ok / ready / yep`, skips the analyzer entirely. Scoring
  "I'm ready" costs a full analyzer call and tells you nothing.
- **Small job descriptions never embed.** At four chunks or fewer, the top-k
  *is* the whole document, so retrieval would pay an embedding call per turn to
  reassemble text that could have been sent once. Below that threshold the JD is
  inlined whole — which also moves it into the cacheable layer (see below), so
  the small-JD path is cheaper on *both* counts.

Rough per-turn total, uncached: **~3,200 input / ~400 output** without a job
description, **~5,800 / ~400** with one. At `gpt-4o-mini` pricing that is
roughly $0.0007–0.0011 a turn, so a 10-question round costs about a cent.

That is small enough that the honest conclusion is: **cost was never the real
problem here.** The reason to do this work is that an unmeasured system can't be
reasoned about, and the things that *would* hurt at scale — an uncapped analyzer,
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

So the design goal is: *put everything constant at the front, everything that
changes at the back, and don't switch models mid-session.*

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
- the resume profile
- the job description **only when it was inlined whole**

**Volatile** — changes turn to turn, so it must come after:

- retrieved JD excerpts (different every turn by construction)
- the per-turn coaching signal from the analyzer
- the rolling conversation summary

The JD appears in *both* lists deliberately. A whole inlined document is
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

The analyzer's key is deliberately *not* per-session. Its scaffold depends only
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

> The prompt is *ordered* so that caching engages whenever the prompt is large
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

| Change | Reasoning |
|---|---|
| **Analyzer capped at 900 output tokens** | It ran unbounded on every scored turn. The full rubric JSON fits comfortably; without a cap a rambling model response was billed in full. |
| **`finish_reason === "length"` checked** | With a cap comes truncation. A truncated reply is *almost* valid JSON, so it surfaced as a generic parse failure and the turn silently lost its score. It now names the real cause. |
| **`rawAnalysis` no longer stored or returned** | A verbatim duplicate of the entire analysis object was written to `interview_turn_analyses` and sent over the wire every turn, and read by nobody. It roughly doubled both the row and the response payload. |
| **Transcript read bounded** | The chat route loaded the *entire* transcript, then discarded all but the last few messages — growing linearly with session length and defeating the point of the rolling summary. It now reads a fixed window sized to cover the verbatim window, the prior-question lookup, and whatever aged out since the last summary refresh. |
| **Rolling summary instead of full history** | The last 6 messages go verbatim; everything older is folded into a compact summary regenerated every 4 messages. Cost stops growing with session length. |
| **Resume distilled once** | A CV is summarised into a compact profile (capped at 400 tokens) at upload, and the profile — not the raw document — goes into every prompt. Paid once, not per turn. |
| **Similarity floor with a top-1 fallback** | Chunks below 0.3 cosine similarity aren't worth the tokens, but the floor could remove *everything*, silently dropping role context from both the prompt and that turn's scoring. One weak excerpt beats no context and no signal. |

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

## Deliberately not done

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

---

## Where the code lives

| Concern | File |
|---|---|
| Usage recording | `src/lib/api/token-usage.ts` |
| Usage table | `supabase/migrations/0007_llm_usage.sql` |
| Prompt layering, cache key, model choice | `src/app/api/chat/route.ts` |
| Analyzer scaffold, cap, truncation check | `src/lib/response-analyzer.ts` |
| Rolling summary cadence | `src/lib/summary.ts` |
| Similarity floor, small-JD inlining | `src/lib/db/job-descriptions.ts` |
| Resume distillation | `src/lib/resume-profile.ts` |
