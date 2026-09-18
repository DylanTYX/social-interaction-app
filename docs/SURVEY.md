# Scope survey: which interview rounds students actually face

Why this exists, what it asks, what each answer is allowed to prove, and what
would disprove it.

The system practises six kinds of interview round and fifteen technical topics,
and it is scoped to Computer Science roles. Those choices were made from
curriculum standards and employer guidance (see
[DRILLS.md](DRILLS.md) §4). This survey tests them against the people the system
is for.

**Stated plainly, because a viva will ask.** The build came first. This survey
does not claim to have driven the scope; it tests a scope already chosen, and it
can embarrass it. The report should say so in those words. A result that
contradicts the build is a finding, not a failure — §6 lists, for each claim,
the result that would sink it.

---

## 1. What it has to answer

| # | Claim in the report | Question that tests it |
| - | ------------------- | ---------------------- |
| C1 | Computing students are the right user group | Q2 against Q6, Q9 |
| C2 | These six round types are the ones worth practising | Q6, Q7, Q8 |
| C3 | The fifteen technical topics match what is asked | Q9 |
| C4 | Adapting to the answer is the gap in existing tools | Q10, Q11, Q12 |
| C5 | Voice is the right default | Q13 |
| C6 | Multi-round practice is worth building | Q14 |

C1 is the one that needs students outside computing. If every faculty reports
the same needs, scoping to Computer Science is arbitrary and the report should
say so. If the behavioural rounds are shared but the technical ones are not,
that is the evidence for what the system does: one behavioural core, a
CS-specific technical half.

---

## 2. Method

- **Instrument.** Google Form, anonymous, 16 questions, about four minutes.
  Build it by running `artifacts/survey-form.gs` (see §5), or copy §4 by hand.
- **Population.** Undergraduate and recent-graduate students, sampled across
  faculties rather than only computing. Convenience sample through course and
  hall group chats and faculty club channels.
- **Target.** 30 responses minimum, with at least 10 from computing and at least
  three faculties represented. Below that, report the counts and call it
  indicative, not representative.
- **Ethics.** Voluntary, anonymous, no email collected, consent taken on the
  first question, and one line saying the results appear in a final-year report
  in aggregate. Nothing here asks for a name, a student number, an employer or
  a grade.
- **Analysis.** Counts and medians, split by faculty. No significance testing:
  a convenience sample of this size cannot support it, and claiming otherwise
  would be worse than reporting plain counts.

---

## 3. Form settings

- Collect email addresses: **off**.
- Limit to one response: **off**. It requires sign-in, which breaks anonymity;
  the trade-off is a duplicate risk, and that is the right way round here.
- Progress bar: on. Shuffle: off — the order is deliberate.
- Confirmation message: "Thank you. Your answers are anonymous and will be
  reported only as totals."

---

## 4. The questions

### Section 1 — Before you start

> This short survey asks which kinds of job interview you face and which parts
> you find hardest. It takes about four minutes and is anonymous: no name, no
> email, no student number. Answers are used in aggregate in a final-year
> project report on interview practice software. You may stop at any time.

**Q1. Do you agree to take part?** _(required, multiple choice)_
Yes, I agree · No, I would rather not — a "No" ends the form.

### Section 2 — About you

**Q2. Which faculty or school are you in?** _(required, multiple choice, other)_
Computing / Computer Science / IT · Engineering · Business · Science · Arts and
Social Sciences · Design or Media · Medicine or Health Sciences · Other

**Q3. Year of study** _(required, multiple choice)_
Year 1 · Year 2 · Year 3 · Year 4 or above · Postgraduate · Graduated in the
last year

**Q4. Which kinds of role are you applying for, or planning to?** _(checkbox,
other)_
Software engineering · Data, AI or machine learning · Product management ·
Consulting · Finance or accounting · Design · Research or academia · Marketing,
HR or operations · Not sure yet

**Q5. How many job or internship interviews have you had in the past 12
months?** _(required, multiple choice)_
None · 1–2 · 3–5 · 6 or more

### Section 3 — Kinds of interview round

**Q6. How relevant is each kind of round to the roles you are applying for?**
_(grid: Not relevant · Slightly · Moderately · Very · Essential)_
Rows: Recruiter screen (background and motivation) · Behavioural questions
("tell me about a time…") · HR and people questions (values, notice, salary) ·
Technical coding questions · System design questions · Computer science
fundamentals (explain a concept)

**Q7. How difficult do you find each one?** _(grid: Have not faced it · Not
difficult · Slightly · Moderately · Very difficult)_
Same six rows.

**Q8. Which would you most want to practise? Choose up to three.**
_(checkbox, max 3)_
Same six options · None of these

### Section 4 — Technical topics

**Q9. Which technical topics have come up in your interviews, or do you expect
them to? Choose any.** _(checkbox)_
Data structures and algorithms · Programming languages · Testing and debugging ·
Object-oriented design · Databases and SQL · Operating systems · Computer
networks · Security · System design · AI and machine learning · Cloud and
DevOps · Web and front-end · None of these, my interviews are not technical

### Section 5 — How you practise now

**Q10. How do you prepare for interviews today? Choose any.** _(checkbox,
other)_
Reading question lists or guides · Coding practice sites · Mock interview with a
friend · University career service · Paid coaching · Asking an AI chatbot to
role-play · Recording myself · I do not prepare

**Q11. How useful is your current preparation?** _(scale 1–5: Not useful at all
→ Very useful)_

**Q12. What is missing from how you practise now? Choose any.** _(checkbox,
other)_
Follow-up questions that react to what I said · Feedback on what I said ·
Feedback on how I sounded · Realistic pressure · Questions tied to a specific
job description · Practising several rounds in one sitting · Knowing what to
work on next · Nothing is missing

**Q13. If you practised with software, would you rather speak your answers or
type them?** _(multiple choice)_
Speak them · Type them · Depends on the round · No preference

**Q14. Would practising several rounds back to back — screen, then technical,
then hiring manager — be useful to you?** _(multiple choice)_
Yes · No · Unsure

### Section 6 — In your words

**Q15. What is the hardest part of interviews for you?** _(paragraph)_

**Q16. Anything else you would want practice software to do?** _(paragraph,
optional)_

---

## 5. Building the form

`artifacts/survey-form.gs` creates the whole form, questions, grids, scales and
settings included.

1. Open [script.google.com](https://script.google.com) → **New project**.
2. Paste the file's contents, save, and run `createScopeSurvey`.
3. Grant the permissions it asks for. The log prints the edit and share URLs.
4. Check the consent wording, then send the share URL.

Responses land in the form; use **Link to Sheets** for analysis.

---

## 6. Reading the results honestly

For each claim, what supports it and what sinks it:

| Claim | Supported if | Sunk if |
| ----- | ------------ | ------- |
| C1 Computing is the right scope | Computing respondents report technical rounds as relevant far more often than other faculties | Technical rounds matter equally everywhere, or barely anywhere |
| C2 The six round types | Each round type is "very relevant" or "essential" to a meaningful share, and Q8 spreads across them | A round type nobody rates above "slightly" — it should be cut or justified another way |
| C3 The fifteen topics | The topics named in Q9 sit inside the fifteen | A topic appears often that the system cannot mark, for example a whiteboard maths round |
| C4 Adaptation is the gap | "Follow-up questions that react to what I said" is among the top answers in Q12 | Respondents mostly want more questions, not better ones — which would favour a question bank |
| C5 Voice by default | "Speak them" leads Q13 | "Type them" leads, in which case the default is wrong and the report should say the build chose otherwise |
| C6 Multi-round practice | A clear majority say yes in Q14 | Split or negative, in which case loops are a feature, not a headline |

Report the counts either way. A survey that only ever agrees with the system it
was written for is not evidence.

---

## 7. Sample data, and what it is not

`artifacts/survey-responses-sample.csv` holds **12 fabricated responses**. They
exist so the analysis and the charts can be built before real responses arrive,
and every row carries a `Synthetic` column set to `TRUE`.

**They are not participants and must never be reported as data.** Delete the
file, or the synthetic rows, before any figure from the real sheet goes into the
report. Presenting invented responses as findings is research misconduct, and it
would be trivially caught: the timestamps are all one afternoon.
