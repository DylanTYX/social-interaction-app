# ConvoTrainer — User Acceptance Testing (UAT)

**Version:** 1.0  
**Audience:** Friends & family testers (non-technical OK)  
**Goal:** Confirm features work, find bugs, and judge whether the app is easy and pleasant to use.

---

## 1. Before you start (facilitator — you)

### 1.1 Environment

| Item             | What to do                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| App URL          | Use your deployed URL **or** `http://localhost:3000` if testing locally                                                |
| Backend          | Supabase project running; migrations applied (`0001`–`0009`, including resumes, the atomic-turn RPC and turn analyses) |
| AI               | OpenAI (or configured provider) API keys set in server env                                                             |
| Voice (optional) | Azure Speech credentials if testing voice interviews                                                                   |
| Test accounts    | Create **2–3 separate accounts** (e.g. `tester1@…`, `tester2@…`) so testers don’t overwrite each other’s data          |

### 1.2 Devices (assign per tester)

| Profile  | Device               | Browser                     | Notes                                   |
| -------- | -------------------- | --------------------------- | --------------------------------------- |
| Primary  | Laptop, ≥1280px wide | Chrome or Safari            | Required for dashboard walkthrough tour |
| Mobile   | Phone                | Safari iOS / Chrome Android | Bottom nav; tour may not auto-run       |
| Optional | Tablet               | Any                         | Layout between mobile and desktop       |

### 1.3 What to tell testers

- “There are no wrong answers — we want honest reactions.”
- “If something confuses you, say what you _expected_ to happen.”
- “Take screenshots or screen recordings when something breaks.”
- Spend **30–45 minutes** for a full pass, or **15 minutes** for a short pass (Section 3 only).

### 1.4 Bug reporting

Use the template in **Section 6** (copy into Notes, WhatsApp, or a shared doc).  
**Severity:** Blocker = can’t continue · Major = feature broken · Minor = annoying but workaround exists · Cosmetic = visual/text only.

---

## 2. UAT scope map

| Area                       | Route(s)                                          | Logged in?           |
| -------------------------- | ------------------------------------------------- | -------------------- |
| Landing & demo             | `/`                                               | No                   |
| Sign up / Sign in          | `/auth/register`, `/auth/login`                   | No → Yes             |
| Dashboard                  | `/dashboard`                                      | Yes                  |
| Onboarding goal picker     | First visit dashboard                             | Yes                  |
| Dashboard tour (spotlight) | `/dashboard` (desktop, after onboarding complete) | Yes                  |
| Interview setup wizard     | `/simulate/setup`                                 | Yes                  |
| Text interview             | `/simulate/chat`                                  | Yes                  |
| Voice interview            | `/simulate/voice`                                 | Yes (mic permission) |
| Session report             | `/simulate/report/[id]`                           | Yes                  |
| Quick drills               | `/dashboard/drills`                               | Yes                  |
| Sessions history           | `/dashboard/sessions`                             | Yes                  |
| Personas                   | `/dashboard/personas`                             | Yes                  |
| Job descriptions library   | `/dashboard/job-descriptions`                     | Yes                  |
| Resumes library            | `/dashboard/resumes`                              | Yes                  |
| Analytics                  | `/dashboard/analytics`                            | Yes                  |
| Tips & guides              | `/dashboard/help`                                 | Yes                  |
| Settings                   | `/dashboard/settings`                             | Yes                  |
| Command palette            | `⌘K` / `Ctrl+K` (dashboard layout)                | Yes                  |

**Out of scope for this UAT** (unless you explicitly enable them): public share links, mock panel, dark mode.

---

## 3. Short smoke test (~15 min) — good for family

_One tester, one fresh account._

| ID  | Test                    | Steps                                                                         | Expected                                                                             | Pass? | Notes |
| --- | ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----- | ----- |
| S1  | Landing loads           | Open `/`                                                                      | Page loads; hero + animated demo visible                                             | ☐     |       |
| S2  | Scroll to demo          | Click **See it in action** or nav **Demo**                                    | Smooth scroll to **“See your score in 10 seconds”**; heading not hidden under header | ☐     |       |
| S3  | Try question (no login) | Type a short answer → submit feedback                                         | Score + tips appear; no crash                                                        | ☐     |       |
| S4  | Register                | **Get started** → register with email/password                                | Lands on dashboard; no error toast                                                   | ☐     |       |
| S5  | Goal picker             | On first dashboard visit, pick any goal (or Skip)                             | Dialog closes; not stuck                                                             | ☐     |       |
| S6  | Start text practice     | Dashboard → **Interview practice** (or quick action) → complete setup → start | Chat opens; AI asks a question                                                       | ☐     |       |
| S7  | One answer + feedback   | Send one answer; wait for reply                                               | AI responds; if live coaching on, sidebar/panel updates                              | ☐     |       |
| S8  | End session             | End/finish session                                                            | Report page opens with scores/summary                                                | ☐     |       |
| S9  | Sign out / sign in      | Settings or logout → login again                                              | Session list still shows completed session                                           | ☐     |       |

---

## 4. Full functional UAT (~45–60 min)

### 4.1 Marketing & accessibility (logged out)

| ID  | Test                    | Steps                              | Expected                                       | Pass? | Notes |
| --- | ----------------------- | ---------------------------------- | ---------------------------------------------- | ----- | ----- |
| M1  | Nav anchors             | Click Features, How it works, Demo | Each section scrolls into view (smooth scroll) | ☐     |       |
| M2  | Sign in link            | Header **Sign in**                 | Login page                                     | ☐     |       |
| M3  | Invalid login           | Wrong password                     | Clear error; no white screen                   | ☐     |       |
| M4  | Register validation     | Submit empty / weak form           | Inline or toast errors                         | ☐     |       |
| M5  | Try question edge cases | Empty submit; very long answer     | Sensible message or still works                | ☐     |       |

### 4.2 Dashboard & onboarding

| ID  | Test             | Steps                                                                               | Expected                                                                                  | Pass? | Notes |
| --- | ---------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----- | ----- |
| D1  | Dashboard layout | Open `/dashboard`                                                                   | Stats, quick actions, recent sessions, goals card visible                                 | ☐     |       |
| D2  | Goal picker      | New account: pick “Job interview prep”                                              | Redirects toward setup with sensible defaults                                             | ☐     |       |
| D3  | Skip goal picker | New account: **Skip for now**                                                       | Dashboard usable; no repeat every refresh                                                 | ☐     |       |
| D4  | Walkthrough tour | Desktop, onboarding complete, clear `convotrainer.tourDone` in localStorage, reload | 3-step spotlight: sidebar → ⌘K → goals; Skip/Next work; last step scrolls goals into view | ☐     |       |
| D5  | Weekly goals     | Complete a session; check goals card                                                | Progress/streak updates (may need same week)                                              | ☐     |       |
| D6  | Command palette  | Press `⌘K` / `Ctrl+K`                                                               | Search opens; navigate to Drills / Setup                                                  | ☐     |       |
| D7  | Mobile nav       | Phone: open dashboard                                                               | Bottom tabs work; no horizontal overflow                                                  | ☐     |       |

### 4.3 Interview setup wizard

| ID  | Test                     | Steps                             | Expected                                     | Pass? | Notes |
| --- | ------------------------ | --------------------------------- | -------------------------------------------- | ----- | ----- |
| I1  | Mode selection           | Choose Text vs Voice              | Can proceed; voice notes mic permission      | ☐     |       |
| I2  | Scenario / brief         | Custom brief text                 | Saved in flow; reflected in session          | ☐     |       |
| I3  | Persona                  | Pick or customize persona         | Persona name/style affects tone (subjective) | ☐     |       |
| I4  | Job description — paste  | Paste JD text in setup            | Questions feel role-aware (subjective)       | ☐     |       |
| I5  | Job description — saved  | Select saved JD from library      | No duplicate upload needed                   | ☐     |       |
| I6  | Resume — paste           | Paste resume text                 | Launch succeeds                              | ☐     |       |
| I7  | Resume — PDF             | Upload text-based PDF resume      | Text extracted; launch succeeds              | ☐     |       |
| I8  | Resume — bad PDF         | Scanned/image-only PDF            | Clear error; paste fallback suggested        | ☐     |       |
| I9  | Interview loop           | Multi-round loop if exposed in UI | Report offers “next round” when applicable   | ☐     |       |
| I10 | Back / refresh mid-setup | Browser back during wizard        | No corrupted state; can restart              | ☐     |       |

### 4.4 Text interview (`/simulate/chat`)

| ID  | Test               | Steps                                   | Expected                                      | Pass? | Notes |
| --- | ------------------ | --------------------------------------- | --------------------------------------------- | ----- | ----- |
| T1  | First message      | Wait for opening question               | Readable; no infinite loading                 | ☐     |       |
| T2  | Send answer        | Type and send                           | User bubble + AI reply                        | ☐     |       |
| T3  | Streaming          | If enabled in setup                     | Tokens appear progressively                   | ☐     |       |
| T4  | Live coaching      | Enable in setup                         | Feedback sidebar/panel after answer           | ☐     |       |
| T5  | Multiple turns     | 3+ exchanges                            | No crash; context feels coherent              | ☐     |       |
| T6  | End session        | End interview                           | Navigates to report; session marked completed | ☐     |       |
| T7  | Resume in-progress | Leave mid-session → Sessions → continue | Picks up same session                         | ☐     |       |

### 4.5 Voice interview (`/simulate/voice`) — optional

| ID  | Test                | Steps                                                                   | Expected                                                                             | Pass? | Notes |
| --- | ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----- | ----- |
| V0  | Mic check required  | On Review, try to start a voice interview without running the mic check | Launch is blocked with "Run the microphone check before starting a voice interview." | ☐     |       |
| V1  | Mic permission      | Run the mic check, allow microphone                                     | Check passes; launch becomes available; recording UI active                          | ☐     |       |
| V2  | Deny mic            | Run the mic check, block microphone                                     | Clear message naming the problem, before the interview starts                        | ☐     |       |
| V2b | Unsupported browser | Attempt voice in Firefox                                                | Fails with an explanation rather than a silent interview                             | ☐     |       |
| V3  | Speak answer        | One spoken answer                                                       | Transcription + AI response                                                          | ☐     |       |
| V4  | End voice session   | Complete session                                                        | Report loads with voice-appropriate metrics if shown                                 | ☐     |       |
| V5  | Silence submits     | Answer, then stay quiet                                                 | Countdown appears ~1.5s in; submits at 3s                                            | ☐     |       |
| V6  | Thinking pause      | Pause mid-answer for ~2s, then continue                                 | Not cut off; countdown resets                                                        | ☐     |       |

### 4.6 Session report

| ID  | Test               | Steps                                         | Expected                                                        | Pass? | Notes |
| --- | ------------------ | --------------------------------------------- | --------------------------------------------------------------- | ----- | ----- |
| R1  | Report content     | Open report after session                     | Scores, dimensions, feedback visible                            | ☐     |       |
| R2  | Score comparison   | Second completed session                      | Delta vs previous session if shown                              | ☐     |       |
| R3  | Calibration card   | Predict score → reveal                        | Interaction works; no layout break                              | ☐     |       |
| R4  | Print / PDF        | **Download PDF** (browser print)              | Print preview readable; chrome hidden                           | ☐     |       |
| R5  | Next round         | If multi-round configured                     | Starts next round without error                                 | ☐     |       |
| R6  | Per-answer scores  | Scroll the transcript                         | Each of your answers shows its own score plus strengths/gaps    | ☐     |       |
| R7  | Difficulty context | Read under the overall score                  | Names the interviewer's difficulty band and what it means       | ☐     |       |
| R8  | Practise again     | Click **Practise again**                      | Wizard opens pre-filled with the same brief, persona, JD and CV | ☐     |       |
| R9  | Config survives    | After R8, finish a session, reopen the wizard | Job description and CV are still attached                       | ☐     |       |
| R6  | Broken link        | Visit `/simulate/report/fake-id`              | Friendly error, not blank page                                  | ☐     |       |

### 4.7 Libraries & drills

| ID  | Test                | Steps                                 | Expected                                                                 | Pass? | Notes |
| --- | ------------------- | ------------------------------------- | ------------------------------------------------------------------------ | ----- | ----- |
| L1  | Personas CRUD       | Create / edit / delete custom persona | Persists after reload                                                    | ☐     |       |
| L2  | Job descriptions    | Paste + save; list shows entry        | Usable in setup picker                                                   | ☐     |       |
| L3  | Job description PDF | Upload valid PDF                      | Extracted; appears in list                                               | ☐     |       |
| L4  | Resumes             | Paste + save; delete                  | Usable in setup picker                                                   | ☐     |       |
| L5  | Quick drills        | Open drills → complete one question   | Feedback shown; return to list                                           | ☐     |       |
| L6  | Sessions list       | Open past session from list           | Correct report or resume path                                            | ☐     |       |
| L7  | Analytics           | After 2+ sessions                     | Charts/stats populate                                                    | ☐     |       |
| L8  | Trend restraint     | With fewer than 4 scored sessions     | Charts say how many you have rather than drawing a line through 2 points | ☐     |       |
| L9  | Competency coverage | Open analytics                        | Lists all twelve competencies, blind spots first, marked "not yet"       | ☐     |       |

### 4.8 Settings & account

| ID  | Test           | Steps                                             | Expected                                 | Pass? | Notes |
| --- | -------------- | ------------------------------------------------- | ---------------------------------------- | ----- | ----- |
| A1  | Profile tab    | Update display fields if available                | Saves without error                      | ☐     |       |
| A2  | Defaults       | Change default mode / streaming / coaching → save | Next setup pre-filled                    | ☐     |       |
| A3  | Voice settings | Adjust voice options if shown                     | Persists                                 | ☐     |       |
| A4  | Data export    | Export data if button exists                      | File downloads or clear message          | ☐     |       |
| A5  | Logout         | Log out                                           | Cannot access `/dashboard` without login | ☐     |       |

---

## 5. Usability checklist (all testers)

Rate each **1–5** (1 = poor, 5 = excellent). Add one sentence why if ≤3.

| #   | Question                                                                       | Score | Comment |
| --- | ------------------------------------------------------------------------------ | ----- | ------- |
| U1  | I understood what this app is for within 30 seconds of the landing page.       |       |         |
| U2  | I knew what to click to try the product without signing up.                    |       |         |
| U3  | Signing up / signing in was straightforward.                                   |       |         |
| U4  | The dashboard told me what to do next.                                         |       |         |
| U5  | The interview setup wizard felt too long / just right / too short.             |       |         |
| U6  | During the interview, I always knew how to send my answer and end the session. |       |         |
| U7  | The feedback/report helped me understand how to improve.                       |       |         |
| U8  | Error messages (if any) made sense and told me how to fix the problem.         |       |         |
| U9  | The app felt fast enough (no long unexplained waits).                          |       |         |
| U10 | I would recommend this to someone preparing for interviews.                    |       |         |

**Task success (yes/no):**

| Task                                   | Completed without help? |
| -------------------------------------- | ----------------------- |
| Try landing demo question              | ☐                       |
| Create account                         | ☐                       |
| Complete one text interview end-to-end | ☐                       |
| Find past session in history           | ☐                       |
| Upload or paste a job description      | ☐                       |

---

## 6. Bug report template

```
Bug ID: UAT-___
Date:
Tester name:
Device: (e.g. iPhone 15 / MacBook Chrome)
URL:
Account: (test email, or "logged out")

Summary: (one line)

Steps to reproduce:
1.
2.
3.

Expected:
Actual:

Screenshot/recording: (link or attach)

Severity: Blocker / Major / Minor / Cosmetic
```

---

## 7. Suggested sessions with family & girlfriend

| Session | Who                | Focus                                        | Duration |
| ------- | ------------------ | -------------------------------------------- | -------- |
| A       | You (solo)         | Section 3 smoke + fix blockers               | 30 min   |
| B       | Girlfriend         | Section 3 + Usability U1–U10                 | 30 min   |
| C       | Family member 1    | Section 4.1–4.4 (landing + text interview)   | 45 min   |
| D       | Family member 2    | Section 4.5 voice + 4.7 libraries (optional) | 45 min   |
| E       | Anyone mobile-only | D7 + S2 + S3 + shortened S6–S8               | 20 min   |

**Debrief questions (5 min after each session):**

1. What was the most confusing screen?
2. What delighted you?
3. What would you skip or remove?
4. Did anything feel “broken” vs “I didn’t understand it”?

---

## 8. Exit criteria (ready for wider beta)

UAT is **passed** when:

- [ ] All **Section 3** smoke tests pass on desktop Chrome/Safari
- [ ] No **Blocker** bugs open
- [ ] ≤ 3 **Major** bugs open, each with a workaround documented
- [ ] Average usability score **≥ 3.5** on U1, U4, U6, U7 (Section 5)
- [ ] At least **2 non-developer testers** complete one full text interview without facilitator help

---

## 9. Facilitator: replay onboarding tour

For testers who already finished onboarding:

```js
localStorage.removeItem("convotrainer.tourDone");
localStorage.setItem("convotrainer.onboardingComplete", "1");
location.reload();
```

Use a **desktop** window (≥1024px wide).

---

## 10. Known limitations (set expectations)

- Landing **Try question** uses heuristic scoring, not full AI (by design).
- **Image-only PDFs** for JD/resume may fail — paste text instead.
- **Voice** requires mic + speech API configuration.
- **Dashboard tour** does not run on small screens.
- **Public share link** for reports is not in this UAT scope.

---

_Update this document when you fix bugs or add features — bump the version in the header._
