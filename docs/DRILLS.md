# Quick drills

How the drills page works, how its topic list was derived and bounded, and where
every source came from. Written to be quotable in the project report.

---

## 1. What a quick drill is

A drill is **one interview question, answered once, coached in seconds**. Four
properties define it, and every decision below is justified against them:

| Property | Consequence |
|---|---|
| **No setup** | No persona, no job description, no round configuration. Compare the full simulation, which has a four-step wizard. |
| **One question** | No follow-ups, no conversation, no adaptation to your last answer. |
| **No score** | Coaching only. There is no session to score against and no interviewer to calibrate, so no 0–100 number. |
| **Seconds to feedback** | Speak, pause, read. Anything that adds a step is measured against this and usually loses. |

Two consequences that are easy to miss. **The code editor was removed** from
drills: writing and debugging a function takes ten minutes, not seconds, and it
is the answer that most needs the follow-up ("what is the complexity?", "what
about empty input?") that a drill cannot give. And **speaking is the default**,
because an interview is spoken — a drill that only takes typing is the fastest
loop in the product aimed at the half of the skill nobody is assessed on.

---

## 2. Scoping to Computer Science

The project is scoped to Computer Science roles. That scoping is **visible in
the product rather than stated in copy** — no page says "for CS students". It
shows up as:

- the topic list itself, which is CS subjects and nothing else;
- the removal of the **Case / problem-solving** round type, a consulting format;
- the removal of the automatic **"Product case"** round the setup wizard used to
  add when a job description looked like product management, design, data,
  marketing or sales.

That last one mattered most. The app was auto-building a product-management
interview from a pasted job description — the clearest place the scoping was not
true of the software.

---

## 3. How the questions are used

The bank is imported by exactly **three** files: the drills page, the setup
wizard's `loop-step.tsx`, and its own test. It is **not** imported by
`/api/chat`, `persona-engine.ts` or `opening-brief.ts`.

### Flow A — Quick drills: the bank *is* the question

```
DRILL_QUESTIONS (static, hand-written)
  -> getQuestionsForCategory(topic) -> pickRandom()
  -> question on screen
  -> candidate answers (speak or type)
  -> POST /api/coach/suggested-answer
        { question, answer, roundType: meta.roundType, answerMode }
  -> buildCoachSystemPrompt(roundType, answerMode)
        -> COACH_RUBRICS[roundType] -> shape / signals / failureModes / exemplar
  -> coaching returned
```

The bank supplies **what is asked**; `roundType` supplies **how it is marked**.
Nothing is generated and nothing is retrieved.

### Flow B — Interview simulation: the bank is never consulted

Questions there are **written by the model**, per turn, from four inputs:

```
POST /api/chat
  |- generatePersonaPrompt(personaConfig)     -> who is asking, and how
  |- buildOpeningInstruction(...)             -> ROUND_TYPE_SPECS[type].opening
  |     a directive, not a question: "State the coding problem you want
  |     them to solve, then invite them to think out loud"
  |- retrieval over the job description       -> grounded in the actual role
  |     query = previous turn's `nextFocus` (what to probe next),
  |     not the candidate's raw answer
  |- previous turn signal + competency coverage
  -> the model writes the question
  -> analyzer scores the answer against ROUND_RUBRIC_LABELS[roundType]
```

So when a job description is uploaded, the interviewer's questions come from
**retrieval over that document plus the model's own knowledge** — never from the
drill bank.

### Flow C — Setup wizard: the bank as an illustration

`exampleQuestionForRoundType(type, seed)` renders one bank question under each
round card, so choosing a round type shows something concrete rather than only a
grey rubric sentence. A preview, not the question that will be asked.

### Why the two flows do not share a question source

They are different mechanisms for different jobs:

- **A drill is fixed on purpose.** You choose the topic, the question is vetted
  and hand-written, and you can repeat it.
- **An interview is adaptive on purpose.** It follows up on *your* answer,
  probes what *your* job description requires, and tracks competency coverage.
  A static bank cannot do that, and three hundred questions would exhaust.

**Open question, deferred pending evidence.** Three hundred cross-checked
questions is an asset unused in two of three flows, so "never" is too strong.
The candidate change is to inject two or three same-round-type questions into
the chat prompt as **style exemplars only** — phrasing and difficulty
calibration — with an explicit do-not-reuse instruction, while retrieval keeps
supplying subject matter. It is not shipped because **there is no measurement
saying it is needed**: `run-persona-eval.ts` measures whether two personas
interview *differently* and how *demanding* their follow-ups are, not whether
questions are realistic. The way to settle it is to add a realism dimension to
that judge, run it with and without exemplars, and ship only if it wins — the
same standard the coach rubrics were held to.

---

## 4. How the topic list was derived

### The survey

Three bodies of evidence, in decreasing authority:

1. **CS2023**, the ACM/IEEE-CS/AAAI curriculum standard — 17 knowledge areas.
2. **Employer-published interview guidance** — Amazon and Microsoft both list
   their own technical interview topics.
3. **Role-specific preparation sources** — per-subject question sets for OS,
   DBMS, networks, OOP and data science.

Collapsed, these produce roughly **60 candidate domains**.

### The inclusion rule

A domain ships as a topic only if:

> **(a)** an existing or single-new rubric describes a good answer to it, **and**
> **(b)** a CS student plausibly interviews for it.

Rule (a) does the most work, and it is worth being precise about why. A topic is
only meaningful if the coach can mark it well. Sixty topics sharing five rubrics
would make the distinction cosmetic — a bigger menu in front of *worse*
coaching, because answers would be marked against the wrong shape.

### Why not simply ship all 17 CS2023 areas

Because CS2023's own method argues against it:

> *"Topics that every graduate must know have been circumscribed as **CS Core**
> and kept to a minimum. Topics recommended for in-depth study have been labeled
> **KA Core**."*

The standard minimises what everyone must know and gates the rest behind
specialisation. The three-group structure below is the same shape.

### There is no gate and no inference

Worth stating because it is a natural assumption: **nothing in the product
detects or restricts a specialisation.** Drill questions are a static array
picked by `pickRandom()`; the drills page and the bank contain zero references
to job descriptions. Topics are excluded on the two rules above, not because the
app cannot work out who you are. You know your specialisation — you tap the chip.

---

## 5. The 15 topics

| Group | Topic | Marked as | CS2023 area |
|---|---|---|---|
| Behavioural | Behavioural | `behavioral` | SEP |
| Behavioural | Recruiter screen | `screening` | — |
| Behavioural | HR & people | `hr` | — |
| Core technical | Data structures & algorithms | `technical_swe` | AL, SDF |
| Core technical | Programming & languages | `technical_swe` | FPL, SDF |
| Core technical | Testing & debugging | `technical_swe` | SE |
| Core technical | OOP & software design | `cs_fundamentals` | SE, FPL |
| Core technical | Databases & SQL | `cs_fundamentals` | DM |
| Core technical | Operating systems | `cs_fundamentals` | OS, AR |
| Core technical | Computer networks | `cs_fundamentals` | NC |
| Core technical | Security | `cs_fundamentals` | SEC |
| Core technical | System design | `system_design` | PDC, SF |
| Specialisation | AI & machine learning | `cs_fundamentals` | AI, MSF |
| Specialisation | Cloud & DevOps | `cs_fundamentals` | SF, PDC |
| Specialisation | Web & frontend | `cs_fundamentals` | HCI, SPD |

Twenty questions each, **~300 in total**, up from 44. The 15 topics cover **8 of
CS2023's 17 knowledge areas**.

**Security was the gap the survey exposed.** The bank previously contained no
security content at all, despite it being a CS2023 knowledge area, Microsoft
naming TLS in its published guidance, and injection and authentication questions
being routine in any backend interview.

**Specialisations ship their fundamentals layer only.** "Explain overfitting and
how it differs from underfitting" is a definition question and fits the rubric.
"Design a recommender" is a system design question and lives there; "derive
backpropagation" is a maths question and lives nowhere in this product.

---

## 6. The 60-domain audit

**38 of 60 covered.** The 15 topics are not a subset of the 60 — they absorb it.

### Shipped as a topic (18)

Programming · Data Structures · Algorithms · Programming Languages · Operating
Systems · Networking · Databases · Software Engineering · OOP/LLD · System
Design · Security · Testing/QA · Machine Learning · Cloud · DevOps/SRE ·
Web/Frontend · Behavioral · *(plus Recruiter screen and HR, which the survey's
professional track omitted)*

### Merged into a shipped topic (19)

| Domain | Absorbed by |
|---|---|
| Computer Architecture | Operating systems |
| Distributed Systems, Backend, APIs, Distributed Applications, System/Product Thinking | System design |
| Parallel Computing | Operating systems + System design |
| Cryptography | Security |
| Deep Learning, NLP, Generative AI/LLMs, MLOps, Data Science | AI & machine learning |
| Linux/SysAdmin, Containers, Kubernetes, Infrastructure as Code | Cloud & DevOps |
| Project/Resume Deep Dive, Leadership | Behavioural |

### Assessed across every topic (1)

**Communication** — the coach marks it on every answer regardless of subject. A
dimension, not a topic.

### Excluded (22)

| Reason | Domains |
|---|---|
| **Hardware / low-level** — a separate discipline with its own toolchain | Embedded Systems, Embedded C/C++, RTOS, Firmware, Device Drivers, Robotics, IoT |
| **Deep specialisation, rare for new graduates** | Graphics, HCI/UX, Compilers, Formal Methods, Blockchain, Quantum, Computational Science, Computer Vision, Reinforcement Learning, HPC |
| **Not interview-surfaced as its own round** | Discrete Mathematics, Probability & Statistics — they matter *for* algorithms and ML, and are covered there |
| **Adjacent platform** | Mobile |
| **Not Computer Science** | Product Sense, Engineering Management |

---

## 7. Rubrics: why a topic is not a round type

`roundType` is the **rubric selector**, not a UI category. `COACH_RUBRICS[roundType]`
supplies four fields that are interpolated into the coach's system prompt:
`shape`, `signals`, `failureModes`, `exemplar`.

**Drill topic = what you practise. `roundType` = the standard it is marked
against.** Eight of the fifteen topics share `cs_fundamentals` — same marking
standard, different subject matter, which is the correct relationship between
the two rather than a shortcut.

### The worked example

`technical_swe` reads:

> *Restate and constrain the problem, state the approach and why, then the code,
> then complexity, then edge cases.*

Applied to **"how would you find the first non-repeating character?"** that is
exact. Applied to **"what are the four conditions for deadlock?"** it marks an
answer for code and complexity analysis it cannot have, and the tips come back
generic. `system_design` has the same problem in the other direction: perfect
for "design a rate limiter", wrong for "explain normalization".

Nothing described a **definition-and-contrast** answer, which is why
`cs_fundamentals` was added and why it is the only addition:

> *Define the concept precisely, contrast it with the one it is most often
> confused with, then give a concrete case where the difference changed a
> decision.*

### That this matters is measured, not assumed

`docs/COACHING.md` records that introducing per-round rubrics moved rubric
coverage from **20/29 criteria to 29/29**, and distinct system prompts from
**4 of 6 round types to 6 of 6**. Before them, several round types shared one
generic prompt.

### The bug this change exposed

The drills page previously sent `question.category` as the round type, with one
hardcoded exception. That worked only because six of the seven category ids
happened to be spelled the same as round type ids. Renaming a topic to
`operating_systems` would have made `isRoundType` reject it, `roundType` arrive
undefined, and the coach fall back to the **behavioural STAR rubric** — marking
an operating systems answer for storytelling, with nothing on screen to show it
had happened. It now reads `DrillCategoryMeta.roundType`.

---

## 8. Answering by speech

**Speaking is the default.** The microphone is the same one the voice interview
uses (`useSpeechAnswer`), including the long-pause detection that ends the
answer — so the loop is tap, talk, pause, read, with no button between finishing
and seeing the coaching. A spoken answer also gets a **delivery** line — words
per minute, filler count, long pauses — computed in the browser from the
recognizer's own phrase timings, so it costs no tokens and is the one piece of
feedback a typed answer cannot have.

**The coach is told which mode it is reading** (`answerMode`: `text`, `speech`,
`code`). Without it, a speech-to-text transcript — no punctuation, no
capitalisation — had its four tips spent on artefacts of transcription while the
answer went unexamined.

**Speech and text are deliberately not one merged box.** A dictation box you can
edit before sending would destroy what is being measured: the delivery metrics
describe what you *said* while the coaching would run on what you *edited*, and
you would polish before submitting, which a real interview does not allow.
"Revise this answer" already provides the edit path, in the right order —
measure the spoken attempt honestly first, then work the words.

---

## 9. What was removed

| Removed | Why |
|---|---|
| **Case / problem-solving** topic and round type | A consulting format. Not in any CS interview source. |
| **Leadership** topic | Delegation and managing underperformers are a manager's interview. "Influence without authority" and "disagreed with your manager" survive into Behavioural. |
| **Product case / Role-specific case** round suggestions | The wizard auto-built these from product, design, data, marketing and sales job titles. |
| **The code editor on drills** | Not quick, and needs follow-up a drill cannot give. It remains in the interview simulation, where there is a turn structure and an interviewer to ask. |

Removing the `case` round type was safe because `interview-rounds.ts` already
normalises unknown round types on read, so a session persisted with a case round
degrades to a behavioural round rather than crashing.

---

## 10. Extending it

Adding a topic is **one `DRILL_CATEGORIES` entry plus a questions file**. Adding
a marking standard is **one `COACH_RUBRICS` entry** plus a `ROUND_TYPE_SPECS`
entry and a playbook — both are `Record<InterviewRoundType, …>`, so an
incomplete addition is a compile error rather than a runtime gap.

Named candidates, in order of likelihood:

1. **Mobile** — same pattern as Web & frontend, fits `cs_fundamentals` as-is.
2. **Embedded** — would need its own rubric; the answers are about hardware
   constraints rather than concept contrasts.
3. **Bank-as-style-exemplars in the interview prompt** — specified in section 3,
   gated on the measurement described there.

---

## 11. Sources

### Curriculum authority — used to bound scope, not to pick topics

| Source | Used for |
|---|---|
| [CS2023 — ACM/IEEE-CS/AAAI Computer Science Curricula](https://csed.acm.org/) · [Knowledge areas](https://csed.acm.org/knowledge-areas/) · [full report (PDF)](https://ieeecs-media.computer.org/media/education/reports/CS2023.pdf) | The 17 knowledge areas; the CS Core / KA Core distinction that justifies scoping rather than enumerating |

### Employer-published — strongest evidence of what is actually asked

| Source | Used for |
|---|---|
| [Amazon — Software Development Interview Topics](https://www.amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics) | Confirms programming languages, data structures, algorithms, coding, OO design, databases, distributed computing, operating systems, internet topics and ML/AI as interview subjects |
| [Microsoft — Technical Interviewing Guide](https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing.html) | Problem solving, design, coding and testing as evaluation criteria; layered networking, TLS and routing; distributed systems, CAP and partitioning; ML training and evaluation |

### Taxonomy and priority

| Source | Used for |
|---|---|
| [GeeksforGeeks — Computer Science Subjects Interview Questions](https://www.geeksforgeeks.org/computer-science-fundamentals/computer-science-subjects-interview-questions/) | OOP, OS, DBMS and networks as the four core CS subjects |
| [GeeksforGeeks — Interview Preparation Roadmap](https://www.geeksforgeeks.org/blogs/interview-preparation-roadmap/) | Relative weighting across subjects |
| [Indeed — Computer Science Interview Questions](https://www.indeed.com/career-advice/interviewing/computer-science-interview-questions) | Broad overview of CS job interviews |
| [HackerRank — System Design Interview Questions](https://www.hackerrank.com/blog/system-design-interview-questions-software-engineers/) | System design scope and its dependence on seniority |

### Per-topic question sets — cross-checked while writing the bank

| Topic | Sources |
|---|---|
| Operating systems | [GeeksforGeeks](https://www.geeksforgeeks.org/operating-systems/operating-systems-interview-questions/) · [InterviewBit](https://www.interviewbit.com/operating-system-interview-questions/) |
| Databases & SQL | [DataCamp](https://www.datacamp.com/blog/dbms-interview-questions) · [PlacementPreparation](https://www.placementpreparation.io/blog/dbms-interview-questions-for-freshers/) |
| Computer networks | [GeeksforGeeks TCP/IP](https://www.geeksforgeeks.org/blogs/top-50-tcp-ip-interview-questions-and-answers/) |
| OOP & software design | [InterviewBit](https://www.interviewbit.com/oops-interview-questions/) · [GeeksforGeeks](https://www.geeksforgeeks.org/interview-prep/oops-interview-questions/) |
| AI & machine learning | [DataCamp](https://www.datacamp.com/blog/data-scientist-interview-questions) · [Yale OCPD — Data Science Interview Prep](https://careers.environment.yale.edu/blog/2025/04/28/data-science-interviews-2025-guide/) |
