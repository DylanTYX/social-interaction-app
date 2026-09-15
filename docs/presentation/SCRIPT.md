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
| 3 | Types, lint, tests | `npx tsc --noEmit && npm run lint && npm test` | 0, 0, **482 passing, 0 errors** (Node 22) |
| 4 | Supabase reachable | `curl -s -o /dev/null -w "%{http_code}\n" $NEXT_PUBLIC_SUPABASE_URL/rest/v1/` | `401` |
| 5 | Migrations `0001`–`0015` applied | Supabase SQL editor | usage table exists — without `0007` there is no cost demo; `0012` moves usage writes server-side |
| 6 | OpenAI key has credit | `npm run eval -- --runs=1 --only=<one fixture>` | completes, no 429 |
| 7 | App starts | `npm run dev` | loads at `localhost:3000` |
| 8 | **Full dry run** | everything in section 2 | on the machine and network you will present from |
| 9 | Artifacts committed | `npm run eval:persona > docs/artifacts/persona.txt` | so every number has a fallback |

Also fill in on slide 1: **your supervisor's name and the date**.

---

# Section 1 — the slide-by-slide notebook

**Five slides, 1297 words of talk — about 8:39 at a rehearsed 150 wpm**
(nearer 7:52 if you speak quickly).

Each slide below has three parts: **what is on it**, **what to say**, and
**if he asks** — the questions that slide invites, with the real answer and the
numbers behind it. The "what to say" text is the same wording embedded as the
speaker notes in the `.pptx`; both are generated from `build-deck.mjs`, so they
cannot drift apart.

**Slides 2, 4 and 5 carry the argument.** If you are running long, compress
slide 1 and the closing half of slide 3.

---

## Slide 1 · What it is, and what's built — `0:00`

**On the slide.** What the app is, the gap it fills, the four setup steps, and what you get at the end.

### What to say

> Good morning. My final year project is called ConvoTrainer. It's a website
> where you practise job interviews against an AI interviewer.
>
> Why it exists: there are three ways to practise today, and all three have
> the same hole. A list of practice questions asks the same things in the same
> order, whatever you say. A real person reacts perfectly, but isn't available
> at eleven at night. A chatbot will play along, but won't mark you or push
> back when your answer is weak.
>
> None of them connect how you answered to what you get asked next. Closing
> that gap is the project.
>
> So you tell it what job you're going for, and you can attach the real job
> advert and your resume. You choose the kind of round, set what the
> interviewer is like, and start. There are six kinds of round, and each is
> marked differently — a coding answer isn't judged the way a "tell me about a
> time" answer is. You can type or speak. At the end you get a report with a
> score, feedback on every answer, and a better version of each one.
>
> The next four slides are how that works underneath.

**If you are behind, the one-liner:** "Practice question lists don't react to you, a real person can't be on call, and a chatbot won't mark you. This marks every answer and uses the mark to pick the next question."

### If he asks

**"Who is this for?"**

People getting ready for job interviews. I built it around tech interviews
because that's the process I know best, but nothing about it is tech-only —
the sample interviewers include a factory director and a head of marketing.

**"Isn't this just ChatGPT with a good prompt?"**

The AI does write the questions. But three things around it are mine, and you
don't get any of them from a prompt.

First, every answer is marked against a checklist before the next question is
written, and that mark decides the question. Second, it reads your actual job
advert and resume, so the questions are about that job rather than jobs in
general. Third, every AI call is recorded and priced, so I can tell you what
it costs instead of guessing.

**"Why six kinds of round?"**

Because you can't mark them the same way. For a coding answer you care whether
it works and whether it handles the odd cases. For a "tell me about a time"
answer you care whether the person explained the situation and said what they
personally did.

So each kind carries its own checklist and its own follow-up rules. Adding a
seventh kind is one small block of settings in one file.

**"Does it run the code the candidate writes?"**

No. The AI reads the code and comments on it, but nothing is ever run. Running
someone else's code safely needs a locked-down sandbox, which is a whole
project by itself. The report says the code was reviewed and not run, so
nobody is misled.

---

## Slide 2 · How one turn works — `1:19`  ★

**On the slide.** The four steps of a single turn, which checklist gets used, a real example, and why the marking comes first.

### What to say

> Here's the core idea, and it's the one thing I'd like to land.
>
> Four steps. You answer. The system marks that answer. It uses the mark to
> decide what to ask next. Then it asks the follow-up.
>
> The example at the bottom is a real question and answer from my test set.
> Asked about a project with an unrealistic deadline, the candidate says: "We
> had a launch date that was pretty tight. I worked with the team and we
> managed to get most of it done on time."
>
> A human interviewer would spot two things straight away. There's nothing
> concrete — no dates, no numbers. And it's "we" all the way through, so you
> can't tell what this person actually did.
>
> That's exactly what the system checks for. So instead of moving on, the
> follow-up presses for what they personally did.
>
> Why mark it first, rather than at the end? Because a score that only turns
> up at the end can't change the interview. Marking first is the whole reason
> the questions react to you instead of running down a list.
>
> And one word I want to be careful with: this isn't an AI agent. The AI
> writes the questions and marks the answers, but it doesn't decide what
> happens next. My code does. That's on purpose — it means the same answer
> leads to the same decision every time, and I can test it.

### If he asks

**"What is actually on the checklist?"**

There are two, and the kind of round decides which one is used.

**"Tell me about a time" rounds** check four things: did you describe the
situation, was it clear what you were trying to achieve, what did you actually
do (and was that you or your team), and what was the result — ideally with
numbers.

**Technical rounds** score seven things out of ten: did you understand the
problem, was your plan sensible, is the answer correct, is it efficient, did
you explain it clearly, did you handle the awkward cases, and is the code
tidy.

Both also report how vague the answer was, how confident it sounded, whether
it actually answered the question, a list of strengths, a list of gaps, and
one overall score out of 100.

**"How does it get a score out of 100? Isn't that made up?"**

The instructions give it five bands, each with a written definition, and tell
it to stick to them rather than treat them as a suggestion.

0–25 — didn't really engage with the question. 26–45 — a genuine attempt, but
wrong or missing the point. Trying hard doesn't lift you out of this band.
46–65 — partly there, but shallow or vague. 66–80 — solid. Answers the
question with real detail. 81–100 — strong. Specific, well organised, goes
beyond the minimum.

It's also told to judge what was said, not how smoothly it was said. A
confident answer that's wrong still scores low.

**"How does it decide what to ask next?"**

It's a list of rules, checked in order, and the first one that matches wins.

For a "tell me about a time" round: if you never set the scene, it asks you to
start again with the background. If there was no real detail, it asks for
specifics. If you said "we" rather than "I", it asks what you personally did.
If you never said how it turned out, it asks for the result. If you scored
above 75, it says well done and digs deeper. If none of those apply, it asks
more about what you did.

Technical rounds have their own list along the same lines: unclear on the
problem, ask them to clarify; weak plan, ask them to think out loud; wrong
answer, probe it; missed the awkward cases, drill into those.

**"How does it decide how hard the next question is?"**

It adds three things together and keeps the result between 1 and 10:

`difficulty = your score ÷ 10 + 1 if it's repeating itself + (strictness −
warmth) ÷ 4`

So an answer scoring in the 50s starts at 6. A strict interviewer — strictness
9, warmth 4 — adds (9−4)÷4, which is 1.25, giving **7**. A warm one —
strictness 6, warmth 9 — adds (6−9)÷4, which is −0.75, giving **5**.

That's the 5-versus-7 on this deck, and it's arithmetic you can do on paper.

**"Why does a better answer get a harder question?"**

Because the starting point is your score divided by ten. Answer well and it
pushes you; struggle and it eases off. That's what a good interviewer does.

There's a separate rule for when you're doing badly — it makes things tougher
when the answer is weak, or when the system is about to ask the same sort of
question twice in a row.

**"What if the marking is slow, or fails?"**

It gets four seconds. If it isn't finished, the next question is written
without it, so you're never left waiting at a blank screen. The mark still
gets saved a moment later, so your report and the following question aren't
affected. If the marking fails completely, the interview simply carries on
unguided for that one turn.

**"Does the candidate see the mark during the interview?"**

No. The instruction is attached to the interviewer's side of the conversation,
and the interviewer is told never to read it out. You can turn on short live
tips if you want them, and the full breakdown appears in the report at the
end.

---

## Slide 3 · What it's built from — `2:53`

**On the slide.** The four building blocks — the AI, speech, your documents, storage — plus what is and isn't finished.

### What to say

> What it's built from. Four parts.
>
> The AI that asks and marks: a model from OpenAI called GPT-4o-mini. One
> model does all of it — asking, marking, writing feedback. Answers appear a
> word at a time rather than after a long pause.
>
> Speech: a service from Microsoft called Azure Speech. It turns what you say
> into text while you're still talking, and reads the questions out in a
> natural voice. The password for that service never reaches the browser — the
> page asks my server for a short-lived pass instead.
>
> Your documents: attach a job advert and it gets split into small pieces and
> stored so the system can search it by meaning rather than by exact words. So
> when it needs the part about required experience, it finds it even if that
> phrase was never used. Short documents skip the search and go in whole,
> because searching would cost more than it saves.
>
> Storage: a database service called Supabase. Every record is locked to the
> person it belongs to, and the database enforces that rather than my code
> remembering to check.
>
> That last point is the decision I'd defend hardest. The document search runs
> inside that same database, so it's covered by the same lock. A separate
> search product would have been a second place to get security right, and a
> second place to get it wrong.
>
> On progress: every time I change the code, an automatic check runs the tests
> and builds the whole site. I haven't put it online yet — it runs on my
> machine against the real services.

### If he asks

**"Why this AI model and not a bigger one?"**

Cost, mostly — every answer needs two AI calls, so the price adds up fast.

There's a second reason. Using one model everywhere means there is one set of
instructions being repeated, which is what makes the discount on the next
slide possible at all. I originally used a bigger model just for the opening
question and removed it, because mixing two models meant neither could reuse
the other's instructions. Which model it uses is a setting — changing it is
one line.

**"Why not use an AI framework like LangChain?"**

There was nothing for it to do. This is two prompts and a set of rules written
in ordinary code. A framework would have added something extra to install and
learn without removing any of the code I'd still have to write — and it would
have made the logic harder to test, not easier.

**"What does "searched by meaning" mean?"**

Every piece of the job advert is turned into a long list of numbers that
stands for what that piece means. When the system needs something, the thing
it's looking for is turned into numbers the same way, and the closest pieces
come back.

The practical effect: a question about leading people will find a line saying
"line management responsibility", even though the two share no words. A
keyword search would miss it.

**"Why keep the search in the database instead of a dedicated search product?"**

So there is one place, and only one place, that decides who can see what. The
search runs inside the database and filters by who is logged in, so even a
mistake in my own code can't hand back someone else's document. A separate
product would be a second thing to secure, and a second thing to get wrong.

**"Is it secure?"**

Every table has a rule that a record is only visible to the person who owns
it, and the database enforces it — not my code remembering to check. Every
page needs a login. The pages that cost money limit how often they can be
called. Passwords for outside services stay on the server and never reach the
browser.

Two gaps I'd rather name myself than have found: there's no content security
policy yet, and the rate limit is counted in memory on a single machine, so it
would need moving to shared storage before running on several.

**"Why haven't you put it online?"**

I put the interview loop and the cost measurement first, and hosting is the
part that can safely come last. The step-by-step instructions for putting it
online are already written. It's a decision about order of work, not something
I'm stuck on.

---

## Slide 4 · What it costs to run — `4:38`  ★

**On the slide.** How AI billing works, what measuring let me cut, and the discount that turned out not to apply.

### What to say

> This slide is about cost, because running an AI on every answer isn't free.
>
> AI services charge by the amount of text, not per request. Rather than
> estimate that, I record every call the moment it happens, and a small tool
> adds it up and prices it. So when I tell you what a session costs, that's
> something I can look up in front of you rather than a figure I worked out on
> paper.
>
> Once I could see where the money was going, some things were obvious to cut.
> If you type "ok", there's nothing to mark. Anything that's just counting —
> how many words, how often you hedged — is counted by ordinary code, because
> counting isn't judgement and the AI charges for it. And feedback that's
> already been written is reused rather than bought twice.
>
> Then the result I didn't expect. OpenAI will charge half price for the
> opening part of your instructions if it's identical every time — but only
> once that part reaches one thousand and twenty-four tokens. That threshold
> is theirs, not mine. So I arranged my instructions with the unchanging part
> first, to qualify. Then I checked: mine comes to about five hundred and
> ninety. Too short. The discount never applies.
>
> I kept the arrangement, because it costs nothing and it does start working
> once you attach a job advert — which is when there's enough text for it to
> matter. But the tool reports that it didn't apply, in plain words, rather
> than showing a saving I'm not getting.
>
> So the claim isn't that this is cheap. It's that it's measured — including
> the improvement that turned out not to work.

### If he asks

**"Explain the billing from the start."**

AI services charge by the amount of text, not per request. Text is broken into
"tokens", which are about four characters each — so roughly three-quarters of
a word.

You pay for everything you send in: the instructions, the interviewer's
personality, the conversation so far, any attached documents, and the
candidate's answer. Then you pay again, at a higher rate, for everything the
AI writes back. For the model I use it's about 15 cents per million tokens in
and 60 cents per million out. Those rates sit in one file with the date I last
checked them.

**"Where do 1,024 and 590 come from? Did you choose them?"**

**1,024 is not mine.** OpenAI will reuse the opening part of your instructions
and charge half price for it — but only if that part is at least 1,024 tokens
long. That's their rule. I can't change it and I didn't pick it.

**590 is mine**, and it isn't one measurement — it's three things added up.
208 tokens I measured for the fixed instructions, roughly 325 for a typical
interviewer personality, and a short line describing the scenario. So it's an
approximation.

**"If 590 is only approximate, how do you know the discount really doesn't apply?"**

Because I don't rely on the 590 for that. Every time the AI replies, it tells
you how many tokens it reused. My code writes that number down for every
single call.

On a session with no documents attached, that number is zero. Every time. So
the estimate says "this should be too short to qualify" and the actual usage
says "nothing was reused". They agree — and the zero is the real evidence. The
590 just explains why.

**"Why not pad the instructions out to 1,024 and get the discount?"**

You'd be paying full price for about 430 tokens of padding on every single
call, in order to get half price on the rest. It costs more than it saves.

**"What does a session actually cost?"**

About a penny for a ten-question round. I'd call that an estimate rather than
a measurement — it comes from adding up expected sizes, and I haven't yet run
enough real sessions to replace it with an observed figure. It's exactly the
sort of number I don't want to overstate.

**"How do you know the prices are right?"**

They're in one file, with the date I checked them against OpenAI's public
pricing page. If a model isn't listed, the tool reports the cost as unknown
rather than as zero — so a missing price shows up as a gap instead of quietly
making everything look cheaper than it is.

---

## Slide 5 · Inside the marking — `6:30`  ★

**On the slide.** What the marking checks, the rules that pick the next question, what you can change, and the result that proves the settings work.

### What to say

> Last slide: what's going on inside the marking and the question-picking, and
> what you get to change.
>
> Marking first. There's a different checklist for each kind of round. For a
> "tell me about a time" question it checks whether you set the scene, said
> what you personally did, and said how it turned out. For a coding question,
> whether the answer is correct, whether it's efficient, and whether you
> handled the awkward cases. And the marking never knows who asked — a tough
> interviewer and a friendly one give the same answer the same mark, because
> your answer is worth what it's worth.
>
> Picking the next question is a list of rules over that mark, and the first
> one that fits wins. No scene set, it asks you to start again with the
> background. Nothing concrete, it asks for specifics. You said "we", it asks
> what you did. Same tactic twice, it gets harder. It's also told what it has
> already asked, so it doesn't repeat itself.
>
> Now, do the settings on the right actually do anything? Here's the result
> I'd like you to remember.
>
> Take the same question and the same answer, and change nothing but the
> interviewer. A strict one aims at seven out of ten for the next question. A
> warm one aims at five. Same input, different interviewer, genuinely
> different follow-up.
>
> And that isn't the AI being moody. It's a sum: your score sets a starting
> point, and the interviewer's strictness minus their warmth shifts it up or
> down. You could do it on paper and get those same two numbers every time.
>
> That's the trade I made. You set up the interview — the rounds, the
> interviewer, your documents. You don't change the marking rules underneath;
> those are fixed numbers in the code. And fixing them is exactly why the same
> answer gets the same mark twice, and why I can test each rule on its own.

### If he asks

**"Can the marking rules be changed from the app?"**

No. You set up the interview — the rounds, the interviewer, your documents.
The numbers inside the marking are fixed in the code. Only two of your
settings reach them at all: how strict and how warm the interviewer is.

**"Isn't a fixed set of rules worse than letting the AI decide?"**

More flexible, probably. Easier to defend, definitely not.

Because it's ordinary code, I can tell you exactly which rule fired, show you
that it fires the same way every time, and test each one on its own. If the AI
decided, the answer to "why did it ask that?" would be "it just did".

**"Have you tested the rules?"**

Yes. The rules, the counting, the skill matching and the interviewer
generation all have tests. Altogether that's 482 tests across 55 files, and
they run automatically every time I change the code, along with a type check
and a full build of the site.

**"Is the marking actually accurate?"**

I don't know yet, and I'd rather say that than guess.

I've built the thing that will tell me: 18 answers I wrote by hand covering
all six kinds of round, each with the band I expect it to land in, and four
things to measure — how often it lands in the right band, how much the same
answer moves between runs, whether it separates good answers from bad ones,
and how often it leaves parts of the checklist blank.

The design is finished. The run isn't. Each run costs money, and I wanted the
design settled first so the first run is the real one.

**"Does the interviewer's personality change the mark?"**

Not directly — the marking never sees who asked.

But it does indirectly, and I'd rather say it than be caught out by it: a
friendlier interviewer asks easier questions, and easier questions get better
answers. So you shouldn't compare marks from two different interviewers. The
app says so on screen rather than hiding it.

**"How does it avoid asking the same question twice?"**

Two ways. It's given the last ten questions it asked and told not to reuse
them or reword them. And if the rules land on the same tactic twice in a row,
it makes the next question harder instead of asking the same sort of thing
again.

**"What are the "skills you didn't cover"?"**

Twelve things interviews usually look for — handling conflict, dealing with
failure, working when the goal is unclear, leadership, prioritising, and so
on.

After each question, it compares that question against all twelve by meaning
and ticks off the close ones. Any that haven't come up get suggested for the
next question, and it rotates through them — otherwise every interview would
open with the same two.

**"What's the weakest part of this?"**

The round length you set is only a guide — it doesn't actually stop the round
— and the countdown on each answer is a separate fixed number. Those two ought
to be connected and aren't yet. I'd rather tell you than have you find it.

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

It prints the instruction lines that differ between **Aisyah Rahman**
(strictness 9 · warmth 4 · pace 4 · pushback 9) and **Isabella Rodriguez**
(6 · 9 · 6 · 4), the follow-up difficulty each produces on the same candidate
answer — **7/10 vs 5/10** — and the difficulty curve as strictness sweeps 1→10.

> **Say:** "Same question, same answer, same round type. The only variable is who
> is asking. The difficulty target the system sets for the next question moves
> from five to seven — and that's pure arithmetic, not a model call, so it
> reproduces exactly every time."

**Why this pair, if asked:** chosen by inspection, not at random. Two personas
that are both `direct` at strictness 8 would differ by a single pace sentence
and prove nothing. A test fails if a future edit brings Aisyah and Isabella's
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
| Coach-answer cache | Generate a suggested answer, reload, generate again | A row the first time, **none** the second |

**Fallback:** a saved `cost-report` run. Capture one during the dry run.

---

## Part 3 · A live interview — 6 min · needs Node ≥ 20.9

Short round, three questions. Pick the **strict** persona so the pushback is
visible. Then open the report and the cost figures for that session.

What to point at as it happens:

- the coaching rail updating after each answer — that's the analysis you saw on slide 4
- the interviewer escalating rather than moving on, when an answer is thin
- the report: score breakdown, per-answer coaching, suggested answers, competency coverage
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
interviewer's background and four dials, text or voice, an accent per
interviewer nationality, your own
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
