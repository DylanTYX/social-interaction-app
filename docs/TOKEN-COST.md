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

## What the user sees

The same accounting, for the person who caused it. Settings → Usage shows their
own tokens and an estimated cost for a chosen period, grouped by what the tokens
bought, with what caching saved and the date these rates were checked. A report
carries one line for that interview.

`GET /api/me/usage` reads the caller's rows (row-level security scopes it),
prices them with `lib/pricing.ts`, and returns totals only. The rate card stays
server-side: the lint rule in `eslint.config.mjs` permits it under
`src/app/api` and bars it from every page and component.

A figure shown to a user is an estimate and says so. An unpriced model is named
rather than costed at zero, exactly as in the report below.

---

## What one turn costs

A single text turn makes up to four model calls:

| Call            | Model                    | When                       | Cap               |
| --------------- | ------------------------ | -------------------------- | ----------------- |
| Interviewer     | `gpt-5.6-luna`           | Every turn                 | 320 output tokens |
| Analyzer        | `gpt-6-luna`             | Every scored turn          | 900 output tokens |
| Summary refresh | `gpt-6-luna`             | Every 4th message          | 400 output tokens |
| JD embedding    | `text-embedding-3-small` | Only on the retrieval path | —                 |

(Why the interviewer and the analyzer are two different model families is
§"Which model runs where" below.)

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

Rough per-turn total, uncached: **~3,530 input / ~400 output** without a job
description, **~5,800 / ~400** with one. These are character counts divided by
four, which overstates this app's prompts by about a fifth: the instructions
and personas measure 4.78 characters to the token (2026-10-19, below), so read
every input figure in this document as an upper bound. On the shipped models
(`gpt-5.6-luna`, `gpt-6-luna`) a steady-state turn costs roughly **$0.0012**
without a job description — about $0.0008 for the interviewer, $0.0003 for the
analyzer (measured: $0.00030 a call over 90 calls), $0.0001 for the summary
amortised — against roughly $0.0015 on the models they replaced
(`gpt-5-mini`, `gpt-4o-mini`; it was $0.0007–0.0011 when everything ran on
`gpt-4o-mini`). A 10-question round costs about a cent and a quarter.

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

### The stable / volatile / steering split

`buildPromptLayers` in [route.ts](../src/app/api/chat/route.ts) emits three
blocks, and `toOpenAIMessages` places them in an order that is load-bearing for
two different reasons — one about cost, one about whether the model obeys.

**Stable** — identical for every turn of a session, so it forms the cacheable
prefix:

- the static interviewer instructions (**measured 2026-09-18: 1,862 chars,
  ~466 tokens**; this document previously recorded 832 chars / ~208 tokens,
  which had been true once and was never re-measured)
- the persona description
- the scenario context
- round-type guidance ("how to run this kind of round")
- the loop handover brief, if this is round 2+ (see below)
- the candidate's resume, verbatim
- the hiring company, when the job description records one
- the job description **only when it was inlined whole**

**Volatile** — changes turn to turn, so it must come after the prefix:

- retrieved JD excerpts (different every turn by construction)
- the rolling conversation summary

**Steering** — the private note naming the strategy, the focus and the
difficulty target. It goes **last, after the transcript and after the answer it
responds to**, and that is not a cost decision:

> Placed ahead of the exchange, as it was until 2026-09-18, the note was
> ignored. On a topic pivot — where it says "change direction" and names the
> subject to open — the model opened that subject **0 times in 10**, asking
> instead about the story it had just been told to leave. With the identical
> text moved after the exchange: **10 times in 10**.

The instruction was never weak; it was outranked by two more recent messages
about the very thing it wanted dropped, beneath a ~656-token persona prompt full
of reasons to dig into the last answer. Recency decided. See
[PERSONA-EVAL.md](PERSONA-EVAL.md) and
[DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) §17.

**This is also the better arrangement for caching**, which is the happy part. The
cacheable prefix is now the stable prompt followed by an append-only transcript,
rather than being cut short every turn by a block that changes every turn. The
prefix grows with the conversation instead of being invalidated by it.

The JD appears in _both_ lists deliberately. A whole inlined document is
identical on every turn and belongs in the prefix; retrieved excerpts are chosen
per question and would poison the prefix if placed there. Which list it lands in
is decided by `jobDescriptionIsStable`.

### What the loop brief costs

The brief carries, per completed round, up to four of the questions that round
actually asked — and only from rounds of the same family, since a technical
round's problems tell an HR interviewer nothing it can act on.

Estimated, not measured: four questions run 60-90 characters each in practice
against a 160-character ceiling, so about **120 tokens per completed round
carried**. Round 4 of a four-round loop therefore adds roughly 360 input tokens
per turn — about **$0.0014 uncached, $0.0007 cached** over a 25-turn round. The
ceiling case, ten rounds all at the character cap, is ~1,600 tokens a turn.

Two things keep that cheap. The brief is written **once at handoff** into
`launch_meta` and read back verbatim, so it is byte-identical for the whole
round and never invalidates the cached prefix mid-round — a future refactor that
recomputed it per turn would cost far more than it looks. And it is bounded at
both ends: `MAX_CARRIED_QUESTIONS` caps the count, `MAX_QUESTION_CHARS` the
length.

This used to be described as moving the prefix in the right direction without
reaching the 1,024-token cache floor. The prefix now clears that floor on its
own (see "The honest caveat" below), so the anti-repeat list is no longer what
decides whether caching fires — it is simply ordered correctly for when it does.

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

On GPT-5.6 and later OpenAI routes caching automatically and says the key is no
longer needed to optimise it. It is still sent, harmlessly, because every model
here can be pointed back at an earlier one by environment variable.

### What GPT-5.6 changed: writes cost extra

The models the app moved to on 2026-10-19 bill the cache differently from the
ones before them. From OpenAI's [prompt-caching guide](https://developers.openai.com/api/docs/guides/prompt-caching):
the minimum cacheable prompt is 1,024 tokens, a cached prefix stays eligible for
30 minutes after its last use, and **tokens written to the cache are billed at
1.25× the uncached input rate**. Earlier models had no write charge.

Measured on 2026-10-19 with two identical 2,299-token requests, 2.5 seconds apart:

| Model          | Call 1: written / read | Call 2: written / read | Read at     |
| -------------- | ---------------------- | ---------------------- | ----------- |
| `gpt-5-mini`   | not reported / 0       | not reported / 2,176   | 0.025 $/M   |
| `gpt-5.6-luna` | **2,296** / 0          | 0 / **2,296**          | 0.02 $/M    |
| `gpt-6-luna`   | **2,296** / 0          | 0 / **2,296**          | 0.01 $/M    |

(`prompt_tokens_details.cache_write_tokens` is the new field.) Three
consequences, all small in dollars and all worth knowing:

- **The first request of a prefix, and the first after 30 idle minutes, pays
  the premium on all of it.** For an interviewer prefix that is about a
  thousand tokens at 0.25 $/M instead of 0.20 — a few hundredths of a cent.
- **Fresh transcript tokens are written too.** The probe wrote 2,296 of 2,299
  tokens, so in a prompt long enough to be cached, nearly everything that was
  not read from the cache was written to it. The effective rate for new input
  on `gpt-5.6-luna` is therefore 0.25 $/M, the same as `gpt-5-mini`'s, and the
  saving comes from the output rate and the cached rate, not from cheaper
  fresh input.
- **Prompts under 1,024 tokens are untouched.** The analyzer (about 800 tokens
  a call) and the summary neither read nor write the cache, so `gpt-6-luna`'s
  0.10 $/M applies in full.

`llm_usage` stores cached tokens but not written ones, so `pricing.ts` applies
this as a rule — in a prompt of at least 1,024 tokens, everything not read from
the cache is priced at the write rate — instead of a count. It is within one
partial block of the truth on the probe above, and it errs towards
over-stating cost, which is the safer side to be wrong on.

---

## The honest caveat: caching may not fire at all

This is the part worth stating plainly, because it is the sort of thing a viva
question goes straight to.

**This section previously said the prefix was ~590 tokens and never cached. That
is no longer true, and the reversal is worth more than the correction.**

Measured on 2026-09-18, at four characters to the token, the same basis as the
rest of this document:

| Part of the stable prefix | Characters | ~Tokens |
| ------------------------- | ---------- | ------- |
| Static interviewer instructions | 1,862 | ~466 |
| Persona description (mean of the six presets) | 2,624 | ~656 |
| Short scenario line | ~200 | ~50 |
| **Total on a bare session** | | **~1,172** |

**Re-measured 2026-10-18.** The static instructions grew to 2,178 characters
(one line telling the interviewer that marked documents are material, not
instructions: SECURITY.md, OWASP LLM01) and the persona description to an
average of 2,723, which at four characters to the token gave about **1,290
tokens** for a bare session.

**Re-measured again on 2026-10-19, with the real tokenizer** — one request
per piece to each of `gpt-5-mini`, `gpt-5.6-luna` and `gpt-6-luna`, subtracting
the cost of an empty request. All three count identically.

| Part of the stable prefix | Characters | Tokens | Characters per token |
| ------------------------- | ---------- | ------ | -------------------- |
| Static interviewer instructions | 2,178 | 459 | 4.75 |
| Persona description (one preset) | 2,663 | 557 | 4.78 |
| **Bare session, each of the six presets, with a 200-character role brief in its marked block** | 5,059–5,236 | **1,053–1,101** | **4.8** |

So the four-characters-to-a-token rule overstated the prefix by about a fifth:
a bare session is **about 1,080 tokens, not 1,290**. It is still above the
1,024-token floor for every preset, but by only 29 to 77 tokens, so a shorter
role brief, a persona with fewer traits, or no scenario at all can put a bare
session under it. A resume or a job description, inlined whole, puts it far
over. Treat "it caches" as the likely case, not a guarantee, and note that this
is the one figure in the report that moved by re-measuring.

Two separate things moved over the life of this section, and only one of them
was deliberate:

- **The persona description roughly doubled**, from ~325 to ~656 tokens at four
  characters to the token (557 measured), when each dial gained a countable
  directive — an acceptance bar, a word budget, a specifics floor, a challenge
  rung. That was a deliberate trade, made to stop the sliders being decoration,
  and it is measured in [PERSONA-EVAL.md](PERSONA-EVAL.md).
- **The static instructions had already grown** from the 208 tokens recorded
  here to ~466, through edits that predate the persona work. Nobody re-measured
  at the time. That is the ordinary way a number in a document goes stale, and
  it is the reason this table gives characters as well as tokens: the next
  person can re-derive it instead of trusting it.

**The analyzer's whole prompt averages about 800 tokens** (measured: 802 per
call across 90 scored answers on `gpt-4o-mini`, 801 on `gpt-6-luna`), scaffold
and answer together. It is under the floor and **never caches**, which on
`gpt-6-luna` also means it never pays the write premium.

So the accurate claim is not "this app uses prompt caching." It is:

> The prompt is _ordered_ so that caching engages whenever the prompt is large
> enough to be worth caching. On small prompts it does not fire — and on small
> prompts it does not matter, because those are the cheap turns.

What changed is which side of the line a bare session sits on, not the argument
for ordering the prompt this way.

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
| **Resume distillation, reversed**              | A resume _was_ summarised into a 400-token profile at upload, and that profile — not the document — went into every prompt. It saved roughly 1,200 cached tokens a turn and cost the fidelity of the whole resume: the interviewer had never read a candidate's actual words, while its prompt label claimed otherwise. Removed. See "Why the resume is sent whole" below.   |
| **Similarity floor with a top-1 fallback**     | Chunks below 0.3 cosine similarity aren't worth the tokens, but the floor could remove _everything_, silently dropping role context from both the prompt and that turn's scoring. One weak excerpt beats no context and no signal.                                                                                                                                           |
| **Summary capped at 400 tokens**               | This was the last uncapped call, and the worst one to leave uncapped: the summary is regenerated _from itself_ and injected into every later prompt, so a single long generation inflated the rest of the session rather than costing once.                                                                                                                                  |
| **Counting moved out of the LLM**              | The analyzer asked the model for a word count, hesitation-marker count, qualifier count, revision count, metric count, and whether timeframes appear. Six pieces of arithmetic, billed in both the scaffold describing them and the response producing them, from a model with no reason to count accurately. Now `text-metrics.ts`; scaffold down from ~296 to ~245 tokens. |
| **Coach answers cached**                       | Generated suggested answers lived in React state only, so reopening a report regenerated all of them at full price for identical input. Now persisted per `(session_id, turn_index)` — see migration `0010`.                                                                                                                                                                 |
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
being taken: the coach route capped at 700 for a 4-8 sentence suggested answer plus
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

## Which model runs where — and why

Decided in two steps. On 2026-09-04 the interviewer and coach moved from
`gpt-4o-mini` to `gpt-5-mini`; on **2026-10-19** every call moved again, because
OpenAI retires both of those models. Prices below are USD per million tokens as
input / cached input / output, checked against the
[pricing page](https://developers.openai.com/api/docs/pricing) and the model pages
on 2026-10-19. `src/lib/pricing.ts` carries the same table in code; if one
moves, move both. The defaults live in `src/lib/models.ts`, which the app and
the harnesses both read.

| Model           | $/M in | $/M cached | $/M out | $/M cache write | Status                                          |
| --------------- | ------ | ---------- | ------- | --------------- | ----------------------------------------------- |
| `gpt-5`         | 1.25   | 0.125      | 10.00   | —               | rejected                                        |
| `gpt-5-mini`    | 0.25   | 0.025      | 2.00    | —               | **replaced**; snapshot retires 2026-12-11       |
| `gpt-5-nano`    | 0.05   | 0.005      | 0.40    | —               | fallback for the compression jobs               |
| `gpt-4o-mini`   | 0.15   | 0.075      | 0.60    | —               | **replaced**; retires 2027-01-14                |
| `gpt-5.6-terra` | 2.00   | 0.20       | 12.00   | 2.50            | OpenAI's named replacement for gpt-5-mini; not used (price) |
| `gpt-5.6-luna`  | 0.20   | 0.02       | 1.20    | 0.25            | **interviewer, coach**                          |
| `gpt-6-luna`    | 0.10   | 0.01       | 0.50    | 0.125           | **analyzer, summary, tidy-up, eval judges**     |

Four facts shape everything below, each verified against OpenAI's docs and then
against the API (`npm run eval:models`, all seven call sites accepted on
2026-10-19):

1. **The generations have different request contracts.** Classic models
   (gpt-4o) take `temperature` and `max_tokens`. The original GPT-5 models
   reject `temperature` with a 400, take `max_completion_tokens`, and are
   steered with `reasoning_effort` (`minimal`/`low`/`medium`/`high`). From
   gpt-5.1 onwards — the gpt-5.6-\* and gpt-6-\* models included — `minimal`
   is gone, `none` takes its place, and the sampling parameters are accepted
   at `none` only: "when reasoning effort is not `none`, remove `temperature`,
   `top_p` and `top_logprobs`" (the GPT-6 migration guide). Every model here
   is env-overridable, so `src/lib/model-params.ts` builds the request body per
   generation. The contract the guide describes held on the API: temperature
   0.7 with effort `none` on `gpt-5.6-luna` and temperature 0.1 on `gpt-6-luna`
   were accepted, and so was JSON mode on both, which the docs never state.
2. **Reasoning tokens bill as output, inside the cap.** Above `minimal` (or
   `none`), the hidden reasoning pass consumes `max_completion_tokens`, so the
   helper adds headroom above the visible-output budget. With reasoning off it
   adds none — that setting exists precisely to make a reasoning model behave
   like a fast chat model.
3. **A judge must not share a generation with the model it rates.** This was
   a rule before it was a check. Both live harnesses now print a warning when
   it is broken, because the committed persona run broke it by accident (see
   §"Eval judges").
4. **GPT-5.6 and later charge 1.25× to write the cache** (§"What GPT-5.6
   changed"), which moves the interviewer's saving from the input rate to the
   output rate.

### The decision, per call site

| Call            | Model                    | Effort           | Why this one                                                    |
| --------------- | ------------------------ | ---------------- | --------------------------------------------------------------- |
| Interviewer     | **`gpt-5.6-luna`**       | none (was `minimal`) | The realism-critical call. Passed the persona harness.      |
| Coach           | **`gpt-5.6-luna`**       | `low`            | Output is read verbatim. Passed the coach harness.              |
| Analyzer        | **`gpt-6-luna`**         | none             | Scores as well, steadier, same temperature. Passed `npm run eval`. |
| Summary         | **`gpt-6-luna`**         | none             | Compression; kept more facts than the old model on a spot check. |
| JD tidy-up      | **`gpt-6-luna`**         | none             | Extraction at temperature 0; removed all the boilerplate on a spot check. |
| Eval judges     | **`gpt-6-luna`**         | none             | A different generation from the interviewer and coach.          |
| Embeddings      | `text-embedding-3-small` | —                | Fixed: every stored vector depends on it.                       |
| Voice (STT/TTS) | Azure Speech             | —                | Not an OpenAI decision at all.                                  |

**Interviewer → `gpt-5.6-luna` with reasoning off.** This is the one call where
the model _is_ the product: persona fidelity, evidence-probe phrasing and
steering-block compliance are what the realism requirement lives on, so it keeps
a model with a reasoning setting, and calls it with none of it, because the call
streams into a live voice conversation: no hidden reasoning pass, so
time-to-first-token stays at chat speed and Azure TTS starts speaking on
schedule. Measured on 2026-10-19, ten streamed replies each: a median **892 ms
to the first word against 903 ms** on `gpt-5-mini`, whole reply about 1.1 s on
both. The persona harness (51 follow-ups for each of 14 variants, the same
judge for both models) found every one of 153 topic pivots opening the subject
it was told to open on both interviewers, and the run cost **30% less**
($0.174 against $0.249). One behaviour did not carry over, and it is the
reason this section exists in this form: `gpt-5-mini` quoted the candidate's
own words back in 50 of 51 evidence probes without being asked, and
`gpt-5.6-luna` did so in none. Only one of the seven probe sentences had ever
told the interviewer to quote; the rest relied on a habit of the old model.
All seven now tell the interviewer to quote the phrase back, and the same cell
then quoted in 24 of 24 follow-ups, and in 51 of 51 in the full re-run, which
also held all six dial expectations ([PERSONA-EVAL.md](PERSONA-EVAL.md) §5). A
model change can break an instruction that was never written down, and only a
harness that counts the behaviour will notice. What the move costs:
the interviewer's saving comes from the output rate (1.20 against 2.00 $/M) and
the cached-input rate, since fresh input is written at 0.25 $/M, the old model's
price.

**Coach → `gpt-5.6-luna` at `low` effort.** The suggested answer and the rewrite
are read verbatim by the user — this output _is_ the pedagogy, and it is the
easiest place in the app to notice a better model. Nobody is holding a live
microphone open for it, so `low` buys a planning pass over the rubric for
about a second of extra latency. On the first live run of the coach harness
(22 fixtures, the same scorer and judge for both coaches) it raised the
analyzer's score by 11.4 points against 9.7, invented no quantities where
`gpt-5-mini` invented 0.23 a rewrite, and its tips covered every gap the
analyzer found (1.00 against 0.80) — at the price of longer rewrites (+29
words against +10). Full table: [COACHING.md](COACHING.md) §"Results".

**Analyzer → `gpt-6-luna`.** The old reasoning for holding the analyzer on an
older model was that scoring needs a temperature, so the same answer scores the
same twice, and that every number in the report was measured on it. `gpt-6-luna`
takes the temperature when its reasoning is off, and the numbers were
re-measured rather than assumed: on the same tree and fixtures, five runs each,
`gpt-4o-mini` placed 81.1% of answers in band and `gpt-6-luna` the same 81.1%;
separation widened from 36.6 to 43.7 points; the mean run-to-run spread fell from
2.01 to 1.36 points; and the two fluent-but-wrong answers the harness exists to
catch improved (`tech-weak-code` 50.4 to 44.8, `design-weak` 55.0 to 30.8). It
is not strictly better: all 17 of its misses are too high, and three weak or
mediocre answers now land just over a band boundary. Details in
[EVALUATION.md](EVALUATION.md) §"Model migration".

**Summary and JD tidy-up → `gpt-6-luna`.** Both are compression jobs with a
correctness floor, not a quality ceiling, so they move with the analyzer. No
harness covers them, so each was spot-checked on both models against known
facts: the summary kept all seven checkable details of a ten-message exchange
where `gpt-4o-mini` dropped a colleague's name, and the tidy-up removed all
seven boilerplate items and kept all seven requirement lines where
`gpt-4o-mini` left a benefit line in. `gpt-5-nano` would be cheaper still and
remains the documented candidate if either ever needs trimming.

**Eval judges → `gpt-6-luna`, on one principle.** The persona-eval and
coach-eval judges must not share a generation with the models they judge, or
improvements read as a model grading its own homework. The interviewer and coach
are on `gpt-5.6-luna` (generation five), so the judge is on `gpt-6-luna`
(generation six).

The principle survived; the practice did not, once. The persona harness
carried its own `gpt-4o-mini` default for the interviewer, so the live run
committed on 18 September 2026 (`3e1aa38`) had gpt-4o-mini judging
gpt-4o-mini — two weeks after the app's interviewer had moved to gpt-5-mini
(`fc062c8`), under a comment saying the harness measured the deployed
behaviour. Its figures describe the previous interviewer. Both harnesses now
read the app's constants from `src/lib/models.ts` and warn when judge and
judged share a generation.

**Voice stays Azure Speech end-to-end.** STT and TTS are not model-shopping
decisions here: the accent system (per-nationality voice selection, the
audition artifact), the phrase-list biasing, and the silence-detection
handling are all built on Azure SDK primitives, and the speech token proxy
keeps the key server-side. OpenAI's realtime audio models would replace all of
that plumbing for no measured quality gain on this app's actual requirement —
accented, persona-matched TTS.

### What one session costs after the switch

The interviewer's turn, at ~2,600 input / ~320 output tokens and no job
description, with a ~1,100-token prefix read from the cache after the first turn
(an upper bound, since the 2,600 is at four characters to the token):

| Turn                      | `gpt-5-mini` | `gpt-5.6-luna` | Change |
| ------------------------- | ------------ | -------------- | ------ |
| First of a session or after 30 idle minutes (nothing cached) | $0.00129 | $0.00103 | −20% |
| Steady state (prefix cached) | $0.00104 | $0.00078 | −25% |

Add the analyzer ($0.00033 to $0.00030 a call, measured) and the summary
(about $0.00026 to $0.00019 a refresh, estimated) and a steady-state scored turn
falls from about $0.0015 to about $0.0012. A 20-turn session is roughly 2.4¢,
down from 3.0¢, and the persona harness's whole 714-follow-up, 714-judgement
run cost 17¢. The cost report (`npm run cost-report`) prices every model from
the same table, so these are checkable against `llm_usage` rather than against
this paragraph — which, like the rest of this document, has still not been
checked against live traffic.

### What was considered and rejected

- **`gpt-5` (full) for the interviewer** — 5× the input and output price to
  make a 320-token conversational turn marginally more polished. The realism
  gains in this app came from the persona/decision-engine work, not raw model
  size; nothing in the eval history says the big model moves those numbers.
- **`gpt-5-nano` everywhere** — cheapest possible wiring, but the two
  user-facing call sites are the two where output quality is visible, and
  nano is the family's floor, not its midpoint. Nano remains the documented
  candidate for the two compression jobs.
- **Routing between models per turn** (a cheap classifier deciding when a
  turn deserves a stronger model) — the codebase already implements the
  useful half of this _without a second model_: `detectBehavioralSignals` is
  a deterministic, zero-cost classifier whose hits escalate into evidence
  probes through the decision engine. Adding a model-switching layer on top
  would reintroduce the split-cache problem that §"One model for every
  interviewer turn" exists to prevent — every switch is a cold cache on both
  sides.
- **`gpt-5.6-terra` as the interviewer** (OpenAI's named replacement for
  gpt-5-mini) — 2.00 / 12.00 against 0.25 / 2.00 per million: eight times the
  input rate and six times the output rate for the same 320-token turn. It was
  the fallback had `gpt-5.6-luna` failed the persona harness; it did not.
- **`gpt-5.4-mini`** — three times gpt-5-mini on every rate, and already
  superseded by the 5.6 line.

### The migration, 2026-10-19

OpenAI's [deprecations page](https://developers.openai.com/api/docs/deprecations)
retired both defaults. Each alias has one dated snapshot, which is what the page
lists; the alias goes with it.

| Default       | Announced  | Shuts down | Named replacement | Used here      | Why not the named one                                                       |
| ------------- | ---------- | ---------- | ----------------- | -------------- | --------------------------------------------------------------------------- |
| `gpt-5-mini`  | 2026-06-11 | 2026-12-11 | `gpt-5.6-terra`   | `gpt-5.6-luna` | terra is 8× the input and 6× the output rate; luna is cheaper than gpt-5-mini on every rate |
| `gpt-4o-mini` | 2026-10-14 | 2027-01-14 | `gpt-6-luna`      | `gpt-6-luna`   | — the named replacement                                                     |

`src/lib/models.ts` records the same dates in `MODEL_RETIREMENTS`, and
`npm run eval` prints a notice when the analyzer under test has one.

**The rule that was followed.** A default moves only on a passing harness run on
the candidate, compared with a fresh run on the model it replaces — both from
the same tree. Nothing moves on the strength of a model page.

**What was done, in order, and what each step found.**

1. **Preflight** — `npm run eval:models` (new): one tiny request per call site,
   shaped like the app's own, on the current models and then the candidates. All
   seven accepted both. It exists because the quality harnesses are slow and
   billed, and a 400 on the request format is cheap to find first.
2. **Analyzer** — `npm run eval -- --runs=5` on each model
   ([`eval-gpt-4o-mini.txt`](artifacts/eval-gpt-4o-mini.txt),
   [`eval-gpt-6-luna.txt`](artifacts/eval-gpt-6-luna.txt)). The fresh baseline
   was the surprise: the old model scored **81.1%, not the committed 88.9%**,
   because two fixtures and the prompt had changed since August. The candidate
   passed every criterion (accuracy not lower, separation not narrower, spread
   within +0.5, completeness unchanged, the two fluent-but-wrong fixtures no
   more lenient).
3. **Interviewer** — `npm run eval:persona -- --live --runs=51`, once per model,
   `gpt-6-luna` as judge for both
   ([`persona-eval-live-gpt-5-mini.txt`](artifacts/persona-eval-live-gpt-5-mini.txt),
   [`persona-eval-live-gpt-5.6-luna.txt`](artifacts/persona-eval-live-gpt-5.6-luna.txt)).
   The first candidate run showed the quoting regression above; the earlier
   output is kept as
   [`…-before-quote-fix`](artifacts/persona-eval-live-gpt-5.6-luna-before-quote-fix.txt)
   and the run after the fix is the one that counts.
4. **Coach** — `npm run eval:coach -- --live --runs=2`, the first complete live
   run the harness has had. It had never completed: every judge prompt omitted
   the word "JSON" that JSON mode requires, so each fixture failed with a 400.
5. **Flip, then re-measure.** Defaults changed in `models.ts`; the cached prefix
   was re-measured with the real tokenizer (§"The honest caveat"); the price
   table gained the cache-write rate.

For the next retirement the procedure is the same, in the same order:
`npm run eval:models -- --candidates` first, then the harness for each call site
being moved, then the flip. `candidateModels()` reads `MODEL_RETIREMENTS`, so
add the new announcement there.

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

  Scale makes the same point. The bank is now ~300 questions across 15 topics
  in `src/lib/question-bank/` — roughly **6,000 tokens in total**, up from ~800
  when it held 39. That is larger than it was, and still nowhere near the point
  where retrieval pays: a single round type's slice is a few hundred tokens, the
  drills page selects from it with a plain array filter at zero cost, and the
  whole corpus fits inside a context window many times over. Retrieval earns its
  complexity when the corpus vastly exceeds the budget, which a job description
  can and a question bank cannot.

  The _principle_ underneath the suggestion — retrieve what you already
  generated instead of generating it again — is sound, and it is applied where
  it actually pays: coach answers and JD embeddings
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

### Why the resume is sent whole

The obvious optimisation here is the one that was tried and removed, so it is
worth writing down why rather than leaving the next person to rediscover it.

A resume sits in the **stable prefix**, so it is re-sent on every turn — but from
turn two onwards at the cached rate, and attaching one is a large part of what
pushes a session's prefix past the 1,024-token floor at all. A 24,000-character
Resume works out at roughly **$0.005 for a ten-turn session**, against $0.0012 for
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

Chunking the resume the way job descriptions are chunked was also considered and
rejected. Retrieval returns what is _similar_ to the current conversation, not
what has _not been asked yet_, so it narrows rather than opens; the
"ask something new" job already belongs to `formatAskedQuestions` and the
competency coverage steer; and the retrieval path is `stable: false`, so it
would leave the cacheable prefix and be billed at full rate every turn.

The general lesson: a token optimisation that changes what the model _knows_ is
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

| Concern                                  | File                                          |
| ---------------------------------------- | --------------------------------------------- |
| Usage recording                          | `src/lib/api/token-usage.ts`                  |
| Usage table                              | `supabase/migrations/0001_schema.sql`         |
| Prompt layering, cache key, model choice | `src/app/api/chat/route.ts`                   |
| Analyzer scaffold, cap, truncation check | `src/lib/response-analyzer.ts`                |
| Rolling summary cadence                  | `src/lib/summary.ts`                          |
| Similarity floor, small-JD inlining      | `src/lib/db/job-descriptions.ts`              |
| Resume sent whole, and its one cap       | `src/lib/db/resumes.ts`                       |
| Over-length notice, shared by both docs  | `src/lib/document-truncation.ts`              |
| Deterministic text counting              | `src/lib/text-metrics.ts`                     |
| Input length caps                        | `src/lib/api/input-limits.ts`                 |
| Coach answer cache                       | `supabase/migrations/0001_schema.sql`         |
| JD tidy-up (boilerplate stripping)       | `src/app/api/job-descriptions/clean/route.ts` |
