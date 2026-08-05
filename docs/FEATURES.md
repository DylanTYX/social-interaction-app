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

The setup wizard has five steps. Everything is optional except picking a mode.

### 1. Mode

**Text** — type your answers. **Voice** — speak them, and hear the interviewer
speak back.

### 2. Brief

Describe the role in your own words, or paste a real job description. You can
also attach:

- **A job description** — paste it or upload a PDF. Questions are then tailored
  to that role's actual responsibilities and requirements.
- **Your CV** — paste it or upload a PDF. The interviewer asks about your real
  background and pressure-tests the claims on it, rather than inventing
  experience you don't have.

Both are saved to your library so you can reuse them.

### 3. Build your interview

Start from a preset, or build it yourself:

| Preset | What you get |
|---|---|
| Quick practice | One round, ready to go |
| Screen + behavioural | Two rounds |
| Full SWE loop | Screen, technical, system design, behavioural |
| Suggest from job description | Rounds picked to match the JD you pasted |

Every round is editable. For each one you choose:

**Type** — six kinds, each scored on its own criteria:

| Round | Judged on |
|---|---|
| Intro / screening | Clarity, motivation, fit, concision |
| Behavioural | STAR structure, clarity, specificity |
| Technical SWE | Problem framing, correctness, complexity, edge cases, code quality |
| System design | Requirements, architecture, depth, tradeoffs, scalability |
| Case / problem solving | Problem framing, structure, tradeoffs, depth |
| HR / People | Motivation, values fit, logistics, your questions for them |

**Length** — 5 to 90 minutes. This genuinely controls how long the interview
runs; the slider tells you roughly how many questions to expect.

**Focus** — a free-text note on what this round should dig into.

**Code editor** — technical rounds give you a real editor with syntax
highlighting for Python, JavaScript, TypeScript, Java and SQL, instead of a chat
box. Your code is reviewed by the interviewer, not executed.

**Interviewer** (loops only) — each round can have a different interviewer, so a
loop feels like a real panel rather than the same person four times.

Add a round to make it a loop; a loop also lets you set a break between rounds.

### 4. Interviewer

Pick a saved persona or build one. You control nationality, industry,
seniority, communication style, and four dials: **strictness**, **warmth**,
**pace**, and **pushback**. A high-pushback interviewer challenges your claims;
a warm one gives you room. Save personas to reuse them, or roll a random one.

### 5. Launch

Review the summary, run a microphone check if you're doing voice, and start.

---

## During the interview

- **The interviewer adapts.** Your answer is scored *before* the next question
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
- The full transcript, with per-answer coaching
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
separately, and a breakdown by scenario.

**Drills** — single questions to practise against without setting up a full
interview.

**Libraries** — saved personas, job descriptions and CVs, reusable across
sessions.

**Weekly goal** — set a target number of sessions and track your streak.

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
- **English only**, despite personas having a nationality.
- **Voice needs HTTPS.** Browsers only allow microphone access on a secure
  connection, so voice won't work over a plain `http://` address on your local
  network.
