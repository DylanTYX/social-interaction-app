# ConvoTrainer — User Development Package

ConvoTrainer is an AI interview-practice web application. A candidate describes
the role they are preparing for, chooses an interviewer persona, and runs a text
or voice interview. Every answer is scored against a rubric for the round, and
that score decides what the interviewer asks next.

This package lets another student install, run, test and extend the project from
a clean machine. It is organised as requested:

1. [Software, tools and cloud services](#1-software-tools-and-cloud-services) — what is used, which version, where to get it
2. [Installation procedure](#2-installation-procedure) — from a clean machine to a running app
3. [Environment parameters](#3-environment-parameters) — every setting the code reads
4. [Key folders and files](#4-key-folders-and-files)
5. [Major functions](#5-major-functions)
6. [Key points to take note of](#6-key-points-to-take-note-of)
7. [Troubleshooting](#7-troubleshooting)
8. [Further documentation](#8-further-documentation)

Expect about an hour for a first setup, most of it creating the three cloud
accounts.

---

## 1. Software, tools and cloud services

### 1.1 Tools to install on your machine

| Tool | Version used | Required | Where to get it | Purpose |
|---|---|---|---|---|
| Node.js | 20.20.2 (any **20.9 or later**) | Yes | https://nodejs.org | Runs the app, the tests and the scripts |
| npm | 10.8.2 (ships with Node) | Yes | https://docs.npmjs.com | Installs the packages |
| nvm (optional) | any | No | https://github.com/nvm-sh/nvm (macOS/Linux), https://github.com/coreybutler/nvm-windows (Windows) | Switches Node versions; the easiest way to get Node 20 |
| Git | any recent | Only to clone | https://git-scm.com | Version control |
| Google Chrome or Microsoft Edge | current | For voice mode | https://www.google.com/chrome | Voice interviews need microphone access; tested in Chrome |
| A code editor | any | No | e.g. https://code.visualstudio.com | — |

Node 18 does **not** work: Next.js 16 refuses to start below 20.9.

### 1.2 Cloud services

| Service | What the app uses it for | Plan used | Where |
|---|---|---|---|
| **Supabase** | PostgreSQL database, user accounts and sign-in (Supabase Auth), row-level security, vector search with the `pgvector` extension | Free tier | https://supabase.com |
| **OpenAI API** | The interviewer, the answer assessor, the coach, conversation summaries, job-description tidy-up, and text embeddings | Pay as you go; **requires credit on the account** | https://platform.openai.com |
| **Azure AI Speech** | Speech-to-text and text-to-speech for voice interviews, with accented voices per interviewer nationality | Free tier (F0) is enough | https://portal.azure.com |
| **Vercel** (optional) | Hosting the app on the internet | Hobby (free) | https://vercel.com |
| **GitHub Actions** (optional) | Runs typecheck, lint, tests and build on every push (`.github/workflows/ci.yml`) | Free | https://github.com/features/actions |

The app runs locally without Vercel or GitHub. It cannot run without Supabase and
OpenAI. Azure is only needed for voice interviews; text interviews work without it.

### 1.3 AI models (OpenAI)

All model choices live in one file, `src/lib/models.ts`, and each can be
overridden with an environment variable (section 3).

| Job | Model | Override variable |
|---|---|---|
| Interviewer (asks the questions) | `gpt-5.6-luna` | `INTERVIEWER_MODEL` |
| Coach (suggested answers, rewrites) | `gpt-5.6-luna` | `COACH_MODEL` |
| Assessor (scores each answer) | `gpt-6-luna` | `ANALYZER_MODEL` |
| Rolling conversation summary | `gpt-6-luna` | `SUMMARY_MODEL` |
| Job-description tidy-up | `gpt-6-luna` | `JD_CLEAN_MODEL` |
| Evaluation judges (test harnesses only) | `gpt-6-luna` | `JUDGE_MODEL` |
| Embeddings for job-description search | `text-embedding-3-small` | not overridable |

Indicative cost, at prices checked on 20 October 2026: about **2.4 US cents** for
a 20-answer interview. Rates are in `src/lib/pricing.ts`.

### 1.4 Frameworks and libraries

Installed by `npm ci` from `package-lock.json`, so every machine gets exactly
these versions. Nothing needs installing by hand.

**Runtime (shipped with the app)**

| Package | Version | What it is used for | Documentation |
|---|---|---|---|
| `next` | 16.3.4 | Web framework: pages, API routes, server rendering (App Router) | https://nextjs.org/docs |
| `react`, `react-dom` | 19.2.0 | User interface | https://react.dev |
| `@supabase/supabase-js` | 2.115.0 | Database and auth client | https://supabase.com/docs/reference/javascript |
| `@supabase/ssr` | 0.10.3 | Supabase sessions in cookies, for server rendering | https://supabase.com/docs/guides/auth/server-side |
| `microsoft-cognitiveservices-speech-sdk` | 1.51.0 | Azure speech recognition and synthesis in the browser | https://learn.microsoft.com/azure/ai-services/speech-service/ |
| `@uiw/react-codemirror` | 4.25.11 | Code editor for technical rounds | https://uiwjs.github.io/react-codemirror/ |
| `@codemirror/lang-java`, `-javascript`, `-python`, `-sql` | 6.0.2, 6.2.5, 6.2.1, 6.10.0 | Syntax highlighting in the editor | https://codemirror.net |
| `@radix-ui/react-*` (dialog, dropdown-menu, label, progress, select, slot, switch, tooltip) | 1.1–2.3 | Accessible UI primitives | https://www.radix-ui.com/primitives |
| `tailwind-merge`, `clsx`, `class-variance-authority` | 3.6.0, 2.1.1, 0.7.1 | Composing CSS class names | https://github.com/dcastil/tailwind-merge |
| `lucide-react` | 0.556.0 | Icons | https://lucide.dev |
| `sonner` | 2.0.8 | Toast notifications | https://sonner.emilkowal.ski |
| `react-markdown`, `remark-gfm`, `remark-breaks` | 10.1.0, 4.0.1, 4.0.0 | Rendering interviewer and coach text | https://github.com/remarkjs/react-markdown |
| `unpdf` | 1.8.1 | Reading text out of uploaded PDF resumes and job descriptions | https://github.com/unjs/unpdf |
| `jsonrepair` | 3.15.0 | Repairing slightly malformed JSON from a model | https://github.com/josdejong/jsonrepair |

**Development only**

| Package | Version | Purpose |
|---|---|---|
| `typescript` | 5.9.3 | Type checking (strict mode) |
| `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css` | 4.3.3, 4.3.3, 1.4.0 | Styling |
| `eslint`, `eslint-config-next` | 9.39.5, 16.0.7 | Linting |
| `vitest` | 3.2.7 | Unit tests |
| `jsdom` | 30.0.1 | Browser environment for component tests |
| `tsx` | 4.23.13 | Runs the TypeScript scripts in `src/eval` |
| `dotenv` | 17.4.2 | Loads `.env.local` for those scripts |
| `@types/node`, `@types/react`, `@types/react-dom` | 20.19, 19.2, 19.2 | Type definitions |

Fonts (Geist, Geist Mono, Bricolage Grotesque) are fetched from Google Fonts by
Next.js at build time; nothing to install.

---

## 2. Installation procedure

### Step 1 — Install Node.js 20

With nvm:

```bash
nvm install 20
nvm use 20
node -v    # must print v20.9.0 or later
```

Or download the LTS installer from https://nodejs.org.

### Step 2 — Get the code and install packages

Unzip the package (or `git clone` the repository), then in its folder:

```bash
npm ci
```

`npm ci` installs exactly the versions in `package-lock.json`. Use it rather than
`npm install`, which may pick newer versions.

### Step 3 — Create the Supabase project and database

1. Sign up at https://supabase.com and create a new project. Choose a region near
   you (this project used Singapore) and save the database password somewhere.
2. In the project, open **SQL Editor** and run the four files in
   `supabase/migrations/`, **one at a time and in this order**:

   | File | What it creates |
   |---|---|
   | `0001_schema.sql` | Extensions (`pgcrypto`, `vector`, `pg_trgm`), the nine tables, constraints, indexes, triggers |
   | `0002_security.sql` | Row-level security: each user can only ever read and write their own rows |
   | `0003_functions.sql` | Database functions the app calls, e.g. `append_interview_turn` |
   | `0004_usage_rows_read_only.sql` | Makes usage records write-once |

   Each file is safe to run twice. Without `0003` the app starts but fails on the
   first interview message.
3. Open **Authentication → Sign In / Providers** and make sure **Email** is
   enabled. For local testing you may switch off "Confirm email" so new accounts
   can sign in immediately.
4. Open **Authentication → URL Configuration**. Set **Site URL** to
   `http://localhost:3000` and add `http://localhost:3000/**` to **Redirect URLs**.
5. Open **Project Settings → API** (or **API Keys**) and copy:
   - the **Project URL**
   - the **anon** key, or the newer **publishable** key (`sb_publishable_…`)
   - optionally the **service_role** key, needed only by the operator scripts in
     section 5.6. Keep it secret: it bypasses all row-level security.

### Step 4 — Create an OpenAI API key

1. Sign in at https://platform.openai.com.
2. **Settings → Billing**: add credit. The API has no free allowance, and every
   call fails with HTTP 429 "insufficient_quota" when the balance is zero.
   USD 5–10 is plenty for development and testing.
3. **API keys → Create new secret key**, and copy it once; it is not shown again.

### Step 5 — Create an Azure Speech resource (voice mode only)

1. Sign in at https://portal.azure.com and choose **Create a resource → Speech**
   (listed under Azure AI services).
2. Pick a resource group, region **Southeast Asia** (or any region; note which),
   and pricing tier **Free F0**.
3. When it is created, open **Keys and Endpoint** and copy **KEY 1** and the
   **Location/Region** (for example `southeastasia`).

### Step 6 — Fill in the environment file

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in at least:

```bash
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
AZURE_SPEECH_KEY=<KEY 1>          # voice mode only
AZURE_SPEECH_REGION=southeastasia # voice mode only
```

Every variable is explained in section 3. `.env.local` is ignored by git; never
commit it.

### Step 7 — Check the keys (optional, about USD 0.001)

```bash
npm run eval:models
```

This sends one tiny request per model the app uses and prints `ok` for each. A
`401` means a wrong key; a `429` with "insufficient_quota" means no credit.

### Step 8 — Run the app

```bash
npm run dev
```

Open http://localhost:3000, register an account, and check that:

1. the dashboard loads after sign-in;
2. **New interview → Text interview → Start** produces an opening question;
3. answering it produces a follow-up question;
4. **End interview** opens a report with a score.

For voice mode, choose **Voice interview** and allow microphone access when the
browser asks. `localhost` counts as a secure origin, so no HTTPS is needed
locally.

### Step 9 — Run the checks

```bash
npx tsc --noEmit   # type check
npm run lint       # ESLint
npm test           # 1,000+ unit tests; offline and free, no keys needed
```

These are the same checks CI runs on every push.

### Step 10 — Production build and deployment (optional)

```bash
npm run build
npm start          # serves the production build on http://localhost:3000
```

To put it online, import the repository into Vercel, add the same environment
variables under **Project → Settings → Environment Variables**, deploy, and add
the Vercel URL to Supabase's Site URL and Redirect URLs. The full walk-through,
including the traps that look like app bugs, is in `docs/DEPLOYMENT.md`.

---

## 3. Environment parameters

All are read from `.env.local` locally, or from the hosting provider's settings in
production. The template `.env.local.example` lists them with comments.

### 3.1 Required

| Variable | Used by | Where to get it |
|---|---|---|
| `OPENAI_API_KEY` | Every model call, server side only | OpenAI → API keys (step 4) |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server Supabase clients | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server Supabase clients. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is accepted instead; set one of the two | Supabase → Project Settings → API |

### 3.2 Voice mode

| Variable | Used by | Where to get it |
|---|---|---|
| `AZURE_SPEECH_KEY` | `/api/speech-token`, which exchanges it for a short-lived token. The browser never sees the key | Azure → Speech resource → Keys and Endpoint |
| `AZURE_SPEECH_REGION` | Same route, e.g. `southeastasia` | Same page, "Location/Region" |

### 3.3 Optional model overrides

Leave these unset to use the defaults in section 1.3. After changing one, run
`npm run eval:models`, then the relevant harness in section 5.6.

| Variable | Default |
|---|---|
| `INTERVIEWER_MODEL` | `gpt-5.6-luna` |
| `COACH_MODEL` | `gpt-5.6-luna` |
| `ANALYZER_MODEL` | `gpt-6-luna` |
| `SUMMARY_MODEL` | `gpt-6-luna` |
| `JD_CLEAN_MODEL` | `gpt-6-luna` |
| `JUDGE_MODEL` | `gpt-6-luna` (evaluation scripts only) |

### 3.4 Optional tuning

| Variable | Default | Meaning |
|---|---|---|
| `STEER_DEADLINE_MS` | 4000 | How long a turn waits for the assessor before writing the next question |
| `RETRIEVAL_DEADLINE_MS` | 3000 | How long a turn waits for job-description search |
| `PERSIST_DEADLINE_MS` | 3000 | How long it waits for a late score after the reply, so it can still be saved |

### 3.5 Operator scripts only

| Variable | Used by |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `npm run cost-report` and `npm run seed:demo`. Bypasses row-level security; never expose it to the browser or prefix it with `NEXT_PUBLIC_` |
| `DEMO_EMAIL`, `DEMO_PASSWORD` | `npm run seed:demo`, which creates a demo account with example sessions |

`NODE_ENV` is set automatically by Next.js; do not set it yourself.

---

## 4. Key folders and files

```
.
├── src/
│   ├── app/                    Next.js App Router: every page and API route
│   │   ├── (marketing)/        Landing page
│   │   ├── auth/               Login and registration
│   │   ├── dashboard/          Sessions, analytics, drills, personas, job descriptions,
│   │   │                       resumes, settings, help
│   │   ├── simulate/           setup/ (wizard), chat/ (text interview), voice/ (voice
│   │   │                       interview), loop/ (multi-round overview), report/
│   │   └── api/                Server routes (below)
│   ├── components/             UI, grouped by area: chat, coach, dashboard, persona,
│   │                           report, setup, sessions, ui (shared primitives) …
│   ├── hooks/                  Client-side React hooks (session state, timers, speech)
│   ├── lib/                    All application logic, framework-free and unit tested
│   │   ├── api/                Shared route helpers: errors, rate limiting, input limits,
│   │   │                       token-usage recording
│   │   ├── db/                 Database access, one file per table group
│   │   ├── supabase/           Supabase clients for browser, server and proxy
│   │   └── question-bank/      Questions and categories for Quick Drills
│   ├── eval/                   Evaluation harnesses and operator scripts (never bundled
│   │                           into the app)
│   └── proxy.ts                Runs on every request to refresh the Supabase session
├── supabase/migrations/        Database schema, security and functions (run in order)
├── docs/                       Design documents and evaluation records (section 8)
│   └── artifacts/              Saved outputs of the evaluation runs
├── .github/workflows/ci.yml    Continuous integration
├── .env.local.example          Template for the environment file
├── package.json                Scripts and dependencies
├── next.config.ts              Next.js configuration and security headers
├── eslint.config.mjs           Lint rules, including the one that keeps src/eval out of the app
├── vitest.config.mts           Test configuration
└── tsconfig.json               TypeScript configuration; `@/` means `src/`
```

### 4.1 API routes (`src/app/api/`)

| Route | Purpose |
|---|---|
| `chat` | **The interview turn**: scores the answer, decides the next move, streams the next question, saves the turn |
| `coach/suggested-answer` | Coaching: a suggested answer, a rewrite of the candidate's answer, and tips |
| `sessions`, `sessions/[id]`, `…/report`, `…/resume`, `…/next-round`, `…/activity`, `sessions/bulk`, `sessions/tags` | Create, read, update and delete interview sessions; the report; resuming; moving to the next round of a loop |
| `loops/[loopId]` | Multi-round loop overview |
| `personas`, `personas/[id]`, `personas/reset` | Interviewer persona library |
| `job-descriptions`, `…/[id]`, `…/clean` | Job descriptions: upload, chunk and embed, tidy-up |
| `resumes`, `resumes/[id]` | Resumes |
| `speech-token` | Exchanges the Azure key for a short-lived browser token |
| `analytics/rubric`, `me/sessions`, `me/usage`, `me/export` | Analytics, token usage and cost, data export |
| `client-errors` | Records browser errors |

### 4.2 Database tables (`supabase/migrations/0001_schema.sql`)

`personas`, `job_descriptions`, `job_description_chunks` (with embeddings),
`resumes`, `interview_sessions`, `interview_messages`, `interview_turn_analyses`
(one score per answer), `coach_answers`, `llm_usage` (tokens per model call).
Every table belongs to one user, enforced by row-level security.

---

## 5. Major functions

### 5.1 How one interview turn works

`POST` in `src/app/api/chat/route.ts` runs this pipeline for every answer:

1. **Check** the user is signed in, apply the rate limit, and validate the input.
2. **Fetch context**: relevant job-description excerpts (vector search, at most
   3 s) and the resume.
3. **Score** the answer with `analyzeResponse` (at most 4 s).
4. **Decide** the next move with `decideInterviewAction` and the difficulty with
   `estimateFollowupDifficulty`.
5. **Write the private note** to the interviewer with `buildSteeringBlock`.
6. **Assemble the prompt**: the stable part (rules, persona, role, documents),
   the variable part (summary, excerpts), the recent messages, then the note last.
7. **Stream** the interviewer's reply to the browser.
8. **Save** the turn with `appendTurn`, which calls the `append_interview_turn`
   database function in one transaction.
9. **After the reply**: refresh the summary, update competency coverage, and
   record token usage.

### 5.2 Interview logic (`src/lib/`)

| Function | File | What it does |
|---|---|---|
| `analyzeResponse` | `response-analyzer.ts` | Scores an answer 0–100 against the round's rubric and returns strengths, gaps and a suggested strategy. Never sees the persona, so scores are persona-blind |
| `detectBehavioralSignals` | `text-metrics.ts` | Finds hedged phrases such as "helped with" or "we decided", without a model call |
| `decideInterviewAction` | `decision-engine.ts` | Chooses the next move (drill for specifics, probe a phrase, change topic, …) from the score, the signals and the persona's dials |
| `estimateFollowupDifficulty` | `decision-engine.ts` | Target difficulty from the score and the persona's strictness and warmth |
| `maybeCurveball` | `decision-engine.ts` | Seeded topic changes and what-ifs, driven by the unpredictability dial |
| `buildSteeringBlock` | `steering-block.ts` | The private note the interviewer follows for its next question |
| `deliveryLines` | `persona-delivery.ts` | The persona's tone (warm, even or formal) and challenge level, added to that note |
| `generatePersonaPrompt` | `persona-engine.ts` | Turns a persona's identity and six dials into interviewer instructions. `PRESET_PERSONAS` holds the six built-in interviewers |
| `selectInterviewerPlaybooks` | `interviewer-playbooks.ts` | Round-type guidance (behavioural, technical, system design, …) |
| `buildOpeningInstruction` | `opening-brief.ts` | How the first question of a round is asked |
| `buildLoopBrief` | `loop-brief.ts` | The handover brief passed from one round's interviewer to the next |
| `updateRollingSummary` | `summary.ts` | Compresses older messages so the prompt stays short |
| `collectAskedQuestions` | `asked-questions.ts` | Lists questions already asked, so none is repeated |
| `updateCoverageForQuestion` | `competency-matching.ts` | Matches each question to twelve competencies to track coverage |
| `chunkJobDescription` | `jd-chunking.ts` | Splits a job description into overlapping chunks for embedding |
| `createEmbeddings` | `embeddings.ts` | Embeds text with `text-embedding-3-small` |
| `requestCoaching` | `coach-prompt.ts` | Calls the coach for a suggested answer, a rewrite and tips |
| `extractTextFromPdf` | `pdf.ts` | Reads text out of an uploaded PDF |

### 5.3 Models, cost and safety

| Function / value | File | What it does |
|---|---|---|
| `INTERVIEWER_MODEL`, `ANALYZER_MODEL`, … | `models.ts` | The one place model names are set |
| `completionParams` | `model-params.ts` | Builds a valid request for any model generation (temperature and reasoning settings differ between them) |
| `costOf`, `MODEL_PRICING` | `pricing.ts` | Prices token usage per model |
| `UsageCollector` | `api/token-usage.ts` | Records the tokens each call used into `llm_usage` |
| `enforceRateLimit` | `api/rate-limit.ts` | Per-user request limits on every route |
| `handleRouteError` | `api/errors.ts` | Turns failures into safe, user-facing errors with a reference id |
| (module) | `untrusted-content.ts` | Marks resume, job description and other user text as data, never instructions (prompt-injection defence) |
| `getCurrentUser` | `supabase/server.ts` | The signed-in user for a route |

### 5.4 Voice

| Function | File | What it does |
|---|---|---|
| `resolveVoiceForPersona` | `persona-voice.ts` | Picks the accented Azure voice from the persona's nationality and gender |
| `ACCENT_VOICES`, `paceToRatePercent`, `voiceStyleFor` | `speech-voices.ts` | The audited voice list; pace becomes speaking rate; warm personas get a warm speaking style on the voices that support one |
| `SpeechService` | `speech-service.ts` | Microphone recognition, silence detection, and sentence-by-sentence synthesis |

### 5.5 Data access (`src/lib/db/`)

| Function | File | What it does |
|---|---|---|
| `createSession`, `getSession`, `updateSession`, `listSessions` | `sessions.ts` | Interview sessions |
| `appendTurn`, `listMessages`, `listTurnAnalyses` | `sessions.ts` | Saving and reading turns and their scores |
| `listPersonas`, `planPresetMaintenance` | `personas.ts` | Persona library, including seeding and updating the built-in presets |

### 5.6 Scripts (`package.json`)

| Command | Cost | What it does |
|---|---|---|
| `npm run dev` / `build` / `start` | — | Develop, build, serve |
| `npm test` / `npm run lint` | free | Unit tests / lint |
| `npm run eval:models` | ≈ USD 0.001 | Checks every model call is accepted |
| `npm run eval -- --runs=5` | ≈ USD 0.03 | Scoring accuracy on 18 labelled answers (`docs/EVALUATION.md`) |
| `npm run eval:persona` | free; `-- --live` ≈ USD 0.17 | Do the persona dials change the questions? (`docs/PERSONA-EVAL.md`) |
| `npm run eval:coach` | free; `-- --live` ≈ USD 0.05 | Does coaching improve answers? (`docs/COACHING.md`) |
| `npm run eval:raters` | free | Blind marking sheet for human raters |
| `npm run security-demo` | free | Shows the prompt-injection controls working |
| `npm run cost-report` | free | Prices the usage recorded in the database (needs the service-role key) |
| `npm run seed:demo` | free | Creates a demo account with example sessions (needs the service-role key) |
| `npm run eval:voices` | Azure only | Auditions accent voices |
| `npm run uat-summary` | free | Summarises the user acceptance test logs |

---

## 6. Key points to take note of

1. **Use Node 20.9 or later.** Node 18 fails, and so do the three browser-based
   component tests.
2. **OpenAI calls cost money.** The account needs credit. `npm test` makes no
   calls; the `eval` scripts do, and print their cost.
3. **Run all four migrations, in order,** on a new Supabase project. A missing
   `0003` lets the app build and then fail on the first message.
4. **Keep secrets server-side.** Only the two `NEXT_PUBLIC_SUPABASE_*` values may
   reach the browser. The Azure key is exchanged for a 10-minute token by
   `/api/speech-token`; the OpenAI key is only used in API routes.
5. **Change models only in `src/lib/models.ts`,** then run `npm run eval:models`
   and the harness for that job before relying on it.
6. **Do not change the embedding model** without re-embedding: every stored
   job-description chunk was produced by `text-embedding-3-small`.
7. **The private note must stay last** in the interviewer's messages. It was
   ignored when it sat earlier (`docs/DESIGN-DECISIONS.md` §17).
8. **Scores are persona-blind.** The assessor never receives the persona, so a
   strict interviewer asks harder questions but grades on the same rubric.
9. **Prompt caching** needs a stable prefix of at least 1,024 tokens. Keep
   per-turn content out of the stable part of the prompt or every turn pays full
   price (`docs/TOKEN-COST.md`).
10. **Built-in personas are copied into each account** on first use. Editing
    `PRESET_PERSONAS` changes new accounts, and existing ones only through
    `planPresetMaintenance`.
11. **The rate limiter is in memory,** so limits are per server instance.
12. **`src/eval` is operator tooling.** A lint rule fails the build if the app
    imports it.
13. **Saved evaluation outputs** in `docs/artifacts/` are stamped with the commit
    they came from. Regenerate them from a clean working tree before quoting.
14. **Voice mode** needs Chrome or Edge and microphone permission. Accented
    voices exist only for nationalities whose voice passed an audition; others
    speak neutral English.

---

## 7. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| "Supabase is not configured" | `NEXT_PUBLIC_SUPABASE_URL` or the anon key is missing from `.env.local`; restart `npm run dev` after editing it |
| Registration works but you are sent back to login | Supabase **Redirect URLs** do not include `http://localhost:3000/**`, or "Confirm email" is on and the email has not been confirmed |
| "The interviewer is unavailable right now" | OpenAI key missing, wrong (401) or out of credit (429 insufficient_quota). `npm run eval:models` says which |
| Sending the first message fails; resumed sessions are blank | Migration `0003_functions.sql` was not run |
| Voice mode never hears you | Microphone permission denied, or `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` missing or mismatched |
| `npm run dev` fails on start | Node below 20.9; run `node -v` |

More cases are in `docs/DEPLOYMENT.md` → Troubleshooting.

---

## 8. Further documentation

The `docs/` folder records why the system is built the way it is, and how each
claim was measured. Start with `docs/README.md`, which indexes them. The most
useful for a developer:

| Document | Read it for |
|---|---|
| `docs/FEATURES.md` | Everything the app does, screen by screen |
| `docs/DESIGN-DECISIONS.md` | The reasons behind the main design choices |
| `docs/DATA-MODEL.md` | Tables, functions and migrations in detail |
| `docs/INTERVIEWER.md` | Personas, dials and the decision engine |
| `docs/TOKEN-COST.md` | Model choices, prompt caching and cost |
| `docs/SECURITY.md` | Authentication, row-level security, prompt-injection controls |
| `docs/TESTING.md` | What the tests cover |
| `docs/EVALUATION.md`, `docs/PERSONA-EVAL.md`, `docs/COACHING.md` | The three evaluation harnesses and their results |
| `docs/DEPLOYMENT.md` | Deploying to Vercel |
| `docs/UAT.md` | The user acceptance test plan |
