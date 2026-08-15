# What ConvoTrainer does

A guide to everything the app currently offers. Written for the person using it,
not the person building it.

---

## The short version

You describe the job you're preparing for, choose what kind of interview you
want, and practise against an AI interviewer that adapts to how you actually
answer. Every answer is scored, and the score changes what you get asked next.

You can run **one focused round** — say twenty minutes of system design — or
build a **full interview loop** the way a real company runs one: a recruiter
screen, two technical rounds, then a hiring manager.

---

## Setting up an interview

Four steps. Only one thing is required: a sentence or two about the role.

### 1. Context

**How you want to answer** — _Text_ to type, _Voice_ to speak and hear the
interviewer speak back.

**The role** — describe it in your own words, or tap a quick-start to fill the
box and edit from there. Twenty characters is the minimum; a couple of sentences
works better.

**Documents (optional)** — attach either or both:

- **A job description** — use one you have saved, or add a new one by pasting
  it or uploading a PDF. Questions are then tailored to that role's actual
  responsibilities, and the round builder on the next step can suggest a
  matching set of rounds. Record the company and the interviewer speaks as
  someone who works there — without inventing anything about it that the posting
  does not say. **Tidy this up** strips the navigation, cookie notices and
  boilerplate that come with a copied careers page, tells you how much it
  removed, and can be undone in one click. **Preview** shows exactly what is
  stored, so you can tell two postings for the same role apart and check what a
  tidy-up left behind.
- **Your CV** — paste it or upload a PDF. The interviewer asks about your real
  background and pressure-tests the claims on it, rather than inventing
  experience you don't have.

Both are saved to your library and reusable across sessions.

### 2. Rounds

Start from a preset, or build it yourself:

| Preset                       | What you get                                  |
| ---------------------------- | --------------------------------------------- |
| Quick practice               | One round, ready to go                        |
| Screen + behavioural         | Two rounds                                    |
| Full SWE loop                | Screen, technical, system design, behavioural |
| Suggest from job description | Rounds picked to match the JD you attached    |

Every round is editable. For each one you choose:

**Type** — six kinds, each scored on its own criteria:

| Round                  | Judged on                                                          |
| ---------------------- | ------------------------------------------------------------------ |
| Intro / screening      | Clarity, motivation, fit, concision                                |
| Behavioural            | STAR structure, clarity, specificity                               |
| Technical SWE          | Problem framing, correctness, complexity, edge cases, code quality |
| System design          | Requirements, architecture, depth, tradeoffs, scalability          |
| Case / problem solving | Problem framing, structure, tradeoffs, depth                       |
| HR / People            | Motivation, values fit, logistics, your questions for them         |

**Length** — 5 to 90 minutes. This genuinely controls how long the interview
runs; the slider tells you roughly how many questions to expect.

**Focus** — a free-text note on what this round should dig into.

**Code editor** — the Technical SWE round swaps the chat box for a real editor
with syntax highlighting for Python, JavaScript, TypeScript, Java and SQL. It is
the only round type that offers one: the others are scored on things you write
in prose, so an editor there would be graded against a rubric it cannot satisfy.
Your language choice sticks for the whole round. Code is reviewed by the
interviewer, **not executed** — nothing runs it or tests it.

**Interviewer** (loops only) — each round can have a different interviewer, so a
loop feels like a real panel rather than the same person four times.

Add a round to make it a loop. Changing a round's type re-applies that type's
sensible length and focus — switch to System design and it becomes 30 minutes —
but anything you have typed yourself is left alone.

Between rounds the report suggests a breather scaled to the round you just
finished, so there is nothing to configure.

### 3. Interviewer

Pick one from the library — six presets ship with the app, and anything you save
joins them. Each can be duplicated or deleted from the menu on its card.

On the right you set nationality, industry, seniority, communication style and
years of experience. Four dials sit behind **Fine-tune interviewer style**:
**strictness**, **warmth**, **pace** and **pushback**. A high-pushback
interviewer challenges your claims; a warm one gives you room. Each dial has a
tooltip explaining which direction does what.

Save your edits as a new persona, or update the one you started from.

### 4. Review

Your session at a glance, the two in-interview toggles (response streaming and
live coaching tips), a microphone check if you picked Voice, and the button that
starts it.

## During the interview

- **The interviewer adapts.** Your answer is scored _before_ the next question
  is written, and the verdict steers what comes next. A vague answer gets
  drilled for specifics; a strong one gets pushed a level deeper.
- **Live coaching** (optional) shows a one-line hint under each of your answers,
  plus running scores for clarity, specificity, confidence and structure.
- **Progress** is shown in the header — "Question 4 of ~10" — so you know how
  much is left.
- **Streaming** shows the interviewer's reply as it's written. In voice mode it
  starts speaking before the sentence is finished, which cuts the pause.
- **Voice mode** transcribes as you speak and reports your delivery under each
  answer: speaking pace, filler words, and long pauses.
- **You can stop early** at any point and still get a report.

Sessions are saved as you go. Close the tab and the link still works — you can
pick the interview back up where you left off.

---

## After the interview

### The round report

- Overall score, plus clarity, structure and confidence breakdowns
- A summary of the conversation
- The full transcript, with **each answer's own score** and the strengths and
  gaps behind it — so you can see which answer moved the number, not just the
  number
- **How hard the interviewer was.** The rubric is persona-blind, but question
  _difficulty_ scales with strictness, so the report says which band this
  interviewer sat in and what that means for reading the score. Two 78s from
  different interviewers are not the same achievement.
- Per-answer coaching on demand
- **Model answers** — for any question, see a strong example answer, your own
  answer rewritten, and specific tips
- **Competency coverage** — which of twelve competencies (conflict, failure,
  ambiguity, leadership, prioritisation, ownership, and so on) the interview
  actually explored, and which it didn't. The gaps tell you what to practise
  next.
- **Calibration** — guess your score before revealing it. The gap between what
  you thought and what you got is worth knowing.
- Comparison against your previous session
- Print or save as PDF

### The loop report

For multi-round interviews: how you scored in each round, whether you improved
across the day, recurring strengths, and recurring gaps.

---

## Everything else

**Dashboard** — your recent sessions, average score, time practised, and a
suggestion for what to work on next.

**Analytics** — score trend over time, four skill dimensions tracked
separately, a breakdown by scenario, and **competency coverage across every
session**: which of the twelve competencies have come up, how often, and which
you have never been asked about. The per-session report answers "did this
interview touch delegation?"; this answers "what have I still never practised?"

Trends deliberately stay blank until there is enough data to mean something —
four scored sessions for a line, two sessions in a scenario before it is called
a weakness. A single session is shown as its own score rather than as an
"average".

**Drills** — single questions to practise against without setting up a full
interview. You get **coaching, not a score**: tips, your own answer rewritten
next to what you wrote, and a model answer. Drills deliberately skip the
0-100 analyzer — there is no session to score against and no interviewer to
adapt. If you want a number, run a round.

**Libraries** — saved personas, job descriptions and CVs, reusable across
sessions. Job descriptions are searchable, filterable by company, and editable
after saving — including the title, which is otherwise guessed from the first
line of whatever was pasted. Deleting one says first how many interviews still
in progress are using it; those keep running but lose their grounding.

### One library, two ways in

There is a single job-description library. The setup wizard picks a document
from it or adds one to it — it never keeps a private copy, and a job description
is never attached to one session only. Anything you add mid-setup is saved and
reusable, which is why the wizard says so at the point of adding.

That rule decides what can be changed and when:

- **Company, title, role, link and notes** are copied into the session when it
  launches. Editing them later is always allowed, and never disturbs an
  interview already under way.
- **The text** is read from the search index on every single turn. Editing it
  re-indexes the document, so it is refused while any interview using it is
  still in progress — otherwise the first half of that interview would be
  grounded on one version and the second half on another, with both scored onto
  the same report. Finish or abandon those interviews and the edit goes through.

The same reasoning is why deleting is warned about rather than silently allowed,
and why a job description deleted mid-interview makes the session say so instead
of carrying on as though nothing changed.

**Weekly goal** — set a target number of sessions and track your streak. Both
count sessions you actually practised in, not ones you opened and closed.

**Settings** — default practice mode, streaming and coaching preferences, voice
selection, export all your data as JSON, or delete your interview history.

---

## Current limitations

Worth knowing up front:

- **Code is reviewed, not run.** Technical rounds give you a real editor and the
  interviewer critiques your solution, but nothing executes it or runs tests
  against it.
- **Voice rounds are always prose.** You can't type into an editor by voice, so
  a technical round in voice mode is a spoken discussion.
- **Delivery metrics aren't saved.** Pace, fillers and pauses appear under your
  answer during a voice session but don't reach the report.
- **No hire/no-hire verdict.** You get scores and feedback, not a decision.
- **Drill coaching has not been validated end to end.** The rubric behind it is
  measured (`npm run eval:coach`), but whether the coaching actually makes you
  better is not — see `docs/COACHING.md`, "What has not been measured".
- **English only**, despite personas having a nationality.
- **Voice needs HTTPS.** Browsers only allow microphone access on a secure
  connection, so voice won't work over a plain `http://` address on your local
  network. The setup wizard now requires the microphone check to pass before a
  voice interview can start, so this fails before the interview rather than
  during it.
- **Scores are not directly comparable across interviewers.** The rubric never
  sees the persona, but question difficulty scales with strictness — so a
  supportive interviewer asks easier questions and those answers score higher.
  The report names the difficulty band; the analytics trend does not yet
  separate by persona.
- **The interview screen assumes a desktop browser.** It works on a laptop; on a
  phone the composer and the coaching rail have no small-screen layout.
