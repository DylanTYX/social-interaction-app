# Error handling as a security boundary

What the application tells a stranger, and why each message is worded the way
it is. Scope is deliberately narrow: this document covers the **information
disclosed through error messages and authentication responses**, not the
security of the system as a whole. Transport, password storage, session
handling and row-level access control are covered in `DATA-MODEL.md` and
`DEPLOYMENT.md`, and most of them are properties of Supabase rather than of
this code — the division is set out under "Whose control is it" below.

Every claim here names the evidence behind it. Where a property was reasoned
from configuration rather than tested end to end, it says so. The OWASP and CWE
references were read from `owasp.org` on 24 September 2026, not quoted from
memory; each is linked at the point it is used.

---

## The three defects

### 1. Error messages repeated whatever text they were handed

Forty-five places across twenty-six files rendered a caught error's own
`message`. Nothing decided what a user was allowed to read, so the screen
showed whatever happened to be in the object: the browser's "Failed to fetch",
a JSON parser's complaint about an unexpected `<`, a Supabase SDK string, or
the message of any exception thrown on the way.

Server responses were the more serious half. A configuration failure named the
model provider, the environment variable to set, the hosting platform, the
model, and whether the account had run out of credit. A schema failure named
the migrations directory. Every unexpected 500 carried a Postgres or PostgREST
error class. All of it reached the browser, on a page that needs no
authentication to reach.

**Fixed by** a single gate, `toUserMessage(error, fallback)` in
`lib/user-facing-error.ts`. A message is shown only if the application authored
it — that is, if it is a `UserFacingError`, which includes every message an API
route wrote, carried across the network by `readJson` as an `ApiError`. A
dropped connection becomes one plain sentence. Everything else becomes the
caller's fallback, so an unanticipated exception cannot reach the screen even
in a code path nobody thought about.

Detail meant for whoever runs the deployment moved to an `operatorHint`. It is
always written to the server log under the same `ref` the user is shown, and is
included in the response only when `NODE_ENV` is not `production`.

| | Before | After (production) |
| --- | --- | --- |
| Missing API key | "The interviewer is unavailable: this deployment has no OPENAI_API_KEY. Add it to the environment the deployment runs in (Production and Preview are separate on Vercel), then redeploy." | "The interviewer is unavailable right now. (ref a1b2c3d4)" |
| Schema behind code | "The database is behind this version of the app. Apply the newest migrations in supabase/migrations, in order." | "Something went wrong. Please try again. (ref a1b2c3d4)" |
| Unexpected 500 | "Something went wrong. Please try again. (ref a1b2c3d4 · 42501)" | "Something went wrong. Please try again. (ref a1b2c3d4)" |
| Proxy returns HTML | "Request failed (HTTP 502)." | "Something went wrong. Please try again." |

The `ref` is deliberately kept. It is a random eight-character value with no
meaning outside the log, and it is what makes a support report traceable
without telling the reporter anything.

### 2. Authentication responses distinguished one failure from another

The sign-in, sign-up and password-reset forms printed Supabase's own text. Three
of those strings answer a question the forms should refuse to answer: whether a
given email address has an account on this system.

That question is worth money to an attacker. An address confirmed to exist here
is an address worth trying stolen password lists against, and — because this
application is an interview trainer used by job seekers — the mere fact that
someone holds an account is itself information about them.

**Fixed by** `lib/auth-error-message.ts`, which maps every outcome to an
authored string:

- **Sign-in.** Every refusal, whatever its cause, reads *"Those credentials
  didn't match. Check them and try again."* The word is **credentials**; the
  message never mentions the email or the password separately, so it cannot
  indicate which half was wrong. The one exception is an unconfirmed address,
  which Supabase only reports after the password has already been accepted, so
  it tells a stranger nothing.
- **Sign-up.** Every refusal reads the same, whether or not the address is
  taken.
- **Password reset.** Always *"If an account exists for that email, a reset
  link is on its way."* — including when Supabase rate-limits the request.
  That last case matters: Supabase rate-limits reset emails only for addresses
  that exist, so surfacing the limit would have answered the question that the
  neutral message refuses to answer.

The uniformity is a property of the code, not of the upstream service. The
sign-in mapper collapses every status and code to one string, so the guarantee
holds even if a future Supabase release starts distinguishing the cases.

### 3. The post-sign-in redirect followed any URL it was given

`/auth/login?redirectTo=...` read the parameter and passed it straight to
`router.replace`. The value comes from the URL, so anyone could write one. A
link to a genuine sign-in page on the real domain could deposit the user on
another origin immediately after they authenticated — the familiar shape of a
credential-phishing flow, made more convincing because the first hop really is
the legitimate site and the sign-in really does succeed.

**Fixed by** `lib/safe-redirect.ts`. Only a path on this site is followed;
absolute URLs, protocol-relative `//host` and `/\host` (which browsers read as
another origin) all fall back to `/dashboard`.

---

## Mapping to the OWASP Top 10:2025

Against **OWASP Top 10:2025**, the current revision. Every category title, CWE
membership and quotation below was read from `owasp.org` on 24 September 2026;
the page for each is linked.

| Category | Why it applies | What now prevents it |
| --- | --- | --- |
| **[A10:2025 Mishandling of Exceptional Conditions](https://owasp.org/Top10/2025/A10_2025-Mishandling_of_Exceptional_Conditions)** | New in 2025, and the primary home of this work. It maps **CWE-209 Generation of Error Message Containing Sensitive Information**, and its Scenario #2 is this defect exactly: an attacker triggers database errors to expose system details, then uses them as reconnaissance for a targeted attack | One gate decides what a user may read. A message is shown only if the application authored it; everything else becomes a fallback. Infrastructure detail moved to `operatorHint`, which production never sends |
| **[A07:2025 Authentication Failures](https://owasp.org/Top10/2025/A07_2025-Authentication_Failures)** | The category's own guidance: *"Ensure registration, credential recovery, and API pathways are hardened against account enumeration attacks by using the same messages for all outcomes."* Those are the three flows that leaked here. The category also names credential stuffing, which account enumeration makes cheaper by narrowing the target list | One message for every sign-in refusal, one for every sign-up refusal, one for every reset request — enforced in `auth-error-message.ts`, not inherited from the upstream service |
| **[A01:2025 Broken Access Control](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control)** | **CWE-601 URL Redirection to Untrusted Site** is mapped to this category | `safeRedirectPath` rejects any target that is not a path on this site |
| **[A02:2025 Security Misconfiguration](https://owasp.org/Top10/2025/A02_2025-Security_Misconfiguration)** | Secondary to A10. The category still covers *"lack of central configuration for intercepting excessive error messages"* and error handling that *"reveals stack traces or other overly informative error messages to users"* | The gate is that central interception point, and it is in the application rather than in server configuration |
| **[A09:2025 Security Logging & Alerting Failures](https://owasp.org/Top10/2025/A09_2025-Security_Logging_and_Alerting_Failures)** | Detail removed from a response is only acceptable if it is retained somewhere | Every suppressed hint is logged under the same `ref` shown on screen. **Partially addressed only** — see "What remains" |

**One point of interest for the 2025 revision.** A07's recommended wording is
*"Invalid username or password."* This application says *"Those credentials
didn't match. Check them and try again."* Both satisfy the requirement of one
message for all outcomes, but the second names neither field, so it cannot be
misread as a hint about which half was wrong.

**Not addressed by this work**, listed so the scope is not overstated:
A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection,
A06 Insecure Design, A08 Software or Data Integrity Failures. Injection is
handled elsewhere — parameterised queries through PostgREST, and the
prompt-injection work recorded in `PRODUCTION-REVIEW.md`.

> **If the report cites the 2021 revision instead**, the same three defects map
> to A01 Broken Access Control, A05 Security Misconfiguration (which carried
> CWE-209 before A10:2025 existed) and A07 Identification and Authentication
> Failures. The 2025 mapping is the better one to use, because A10 was created
> for precisely this class of defect.

---

## Mapping to the OWASP Top 10 for LLM Applications 2025

The web Top 10 above covers the application; this list covers the model calls
inside it. Category titles from the OWASP project's own repository
(`2_0_vulns/`), read on 18 October 2026. Every control named is in the code
and, where marked, under test; `npm run security-demo` prints what the
injection and abuse controls do to hostile input.

| Category | How it applies here | Controls | What remains |
| --- | --- | --- | --- |
| **LLM01 Prompt Injection** | The candidate's answer is direct input. The resume, job description and role brief are indirect input written by the user or an employer, and the assessor's notes and the conversation summary are model output derived from the candidate's words, fed into later prompts | Documents and the summary are wrapped in `<<<BEGIN …>>>` blocks a document cannot close, under a standing rule that they are data, not instructions (`untrusted-content.ts`, tested). Notes capped at 3 × 200 characters on one line (tested). The question list never takes candidate turns (tested). Round type and answer mode fall back to defaults (route-tested). The handover brief is stripped from client requests (tested), and every strength, gap and question it carries is cleaned again when it is built — one line, capped, markers defused — even from rows a user wrote directly (tested). The company name is one line of at most 120 characters | No prompt filter is complete; OWASP says so too. A session inserted directly through the REST interface can carry its own brief, confined by RLS to that user (see below). The assessor prompt is unchanged, because it is a scored path and a change needs the evaluation re-run |
| **LLM02 Sensitive Information Disclosure** | Resumes and transcripts are personal data, and they are sent to OpenAI (text) and Azure (audio) to be processed | RLS on every table; keys only on the server; errors generic, with detail in the log under a `ref`; user content kept out of log lines; the analyzer's parse error omits the raw output; export and delete-history | No retention window or in-app account deletion; the providers' own processing is governed by their terms, not by this code |
| **LLM05 Improper Output Handling** | Model output is rendered in the browser, spoken, and — as assessor notes — fed back into prompts | Rendered by `react-markdown` without raw HTML (no `rehype-raw`), with its default URL filtering; a coding problem is shown as plain text; notes are sanitised before reuse | — |
| **LLM06 Excessive Agency** | Would apply if the model could act | The model has no tools or function calls. It cannot read the database, call an API or change state; the strategy, the scoring arithmetic and every write are decided in code | — |
| **LLM07 System Prompt Leakage** | A candidate could ask the interviewer to repeat its instructions | The prompts hold no keys, credentials or other users' data; the interviewer is told not to reveal hidden instructions; a leaked rubric reveals nothing an interview guide does not | A determined candidate may still extract the wording |
| **LLM08 Vector and Embedding Weaknesses** | Job-description chunks are embedded and searched | Each chunk carries its owner; the search function runs with the caller's rights under RLS and filters on `auth.uid()` explicitly; top-k is clamped to 1–8; there is no shared corpus between users | — |
| **LLM09 Misinformation** | The assessor can be wrong, and the interviewer can state something false | Anchored score bands, measured against a control; the resume is sent whole so the interviewer does not invent claims; it is told not to invent company facts; the product gives scores and feedback, never a hiring verdict | The assessor is measurably lenient to fluent wrong answers (EVALUATION.md) |
| **LLM10 Unbounded Consumption** | Every model call costs money, and an answer, a document or a burst of requests can be made large | Input caps (answers over 10,000 characters rejected); output caps on every chat call; per-user rate limits on all 38 handlers; deadlines on the assessor and on retrieval; every call's tokens recorded (`llm_usage`) | The limiter is per process, with no shared store and no global spend ceiling. Usage rows can no longer be edited or deleted by their owner once `0004` is applied |

**What "server-owned" can and cannot mean here.** The server makes every
database write with the signed-in user's own token, so that row-level security
is the one authorisation mechanism. The consequence is that anything the server
can write, the user can also write to their own rows: a `security definer`
function the server calls is callable by the user with the same token, and the
interview messages and analyses the handover brief is built from are rows the
user can insert. So a server-owned field is *checked* — for owner and shape —
but never *proven* to have come from the server. Proving it would need a
privileged key held only by the server and used for every trusted write, which
is a larger design and a new secret to protect. Because the only person a forged
row can affect is the user who wrote it, the proportionate response here is to
bound what such a row can carry: the brief re-cleans every entry, and the
markers it could use to fake a document block are defused.

**Not applicable:** LLM03 Supply Chain and LLM04 Data and Model Poisoning, in
the sense OWASP means — no model is trained, fine-tuned or downloaded here; the
models are called through the provider's API, and npm dependencies are pinned
by the lockfile.

---

## Whose control is it

An honest split, because most of what makes authentication here secure is not
this project's work and should not be presented as such.

| Property | Provided by | This project's part |
| --- | --- | --- |
| Password hashing | Supabase | None |
| Session tokens, refresh rotation | Supabase | None |
| Rate limits on authentication endpoints | Supabase | None |
| Confirmation and reset tokens, and their expiry | Supabase | None |
| Row-level access control | PostgreSQL | The policies in `0002_security.sql` |
| A sign-up endpoint that does not confirm an address exists | Supabase, **when email confirmation is on** | The wording on the form |
| A sign-in form that does not confirm an address exists | — | Entirely this project's |
| Errors that do not describe the system | — | Entirely this project's |

The sign-up row is the one to state carefully. Supabase stops its *endpoint*
from revealing that an address is registered; this project stops the *form*
from doing so. Both are required, and only one of them is this project's work.

---

## How each claim was checked

| Claim | Evidence |
| --- | --- |
| A refused sign-in yields exactly one message across four distinct causes | Unit test: the set of messages has one element (`auth-error-message.test.ts`) |
| Supabase returns `400 invalid_credentials` for an address with no account | Live request against the project's own auth endpoint |
| A dropped connection arrives as `AuthRetryableFetchError`, message "fetch failed" | Live request against an unreachable host |
| Email confirmation is enabled on the project | `GET /auth/v1/settings` returns `mailer_autoconfirm: false` |
| **Sign-up does not distinguish a taken address from a new one** | **Reasoned from the two rows above, not tested end to end.** A test would have created a user that could not be deleted, the service-role key being absent locally. See the manual check below |
| No screen renders a caught error's own message | Search across `src/app`, `src/components`, `src/hooks`: no remaining sites |
| A production response carries only `error` and `ref` | Unit tests with `NODE_ENV` stubbed to `production` assert the exact key set (`errors.test.ts`, `openai-errors.test.ts`) |
| Suppressed detail still reaches the log | The same tests assert the log line contains it |
| Off-site redirect targets are rejected | Unit test over absolute, protocol-relative and backslash forms (`safe-redirect.test.ts`) |
| No existing behaviour regressed | `tsc` clean, `eslint` clean, 896 tests across 83 files, production build succeeds. **Not exercised in a browser** |
| Every OWASP category title, CWE membership and quotation above | Read from the official `owasp.org` page for each category on 24 September 2026; each is linked where it is used |

**The manual check for sign-up**, which takes about a minute: register with an
address that already has an account. The screen should read "Account created.
Check your email to confirm your address, then sign in." — word for word what a
genuinely new address produces. Any difference means email confirmation has
been switched off in the Supabase dashboard, at which point the endpoint itself
starts answering "User already registered" and no wording on the form can
conceal it.

---

## What remains

- **Timing.** The work makes response *content* uniform. It does not equalise
  response *time*, and a sign-up for an existing address may still take
  measurably longer than one for a new address. Closing that requires
  constant-time handling upstream, which is Supabase's to implement.
- **Rate limiting in this application** is still per-process, as recorded under
  "Not fixed, with reasons" in `PRODUCTION-REVIEW.md`. Supabase rate-limits its
  own authentication endpoints, so the sign-in form is covered; this
  application's own routes are not, across multiple instances.
- **Password strength** is checked only for length, at eight characters.
  Supabase offers a check against known-breached passwords; it is not enabled.
- **The `ref` is not aggregated.** It makes one report traceable to one log
  line, which is what it was for. Nothing counts failures, and nothing alerts
  on a rise in them — and A09:2025 is *Logging **& Alerting** Failures*, so the
  alerting half is unaddressed. The category recommends log-correlation
  tooling; this project has none.
- **Detail moved into logs is still detail somewhere.** A09:2025 also maps
  **CWE-532 Insertion of Sensitive Information into Log File**, and the fix
  above deliberately writes infrastructure detail to the log. What goes there
  is environment-variable *names*, a migrations hint, database error classes,
  and up to 2,000 characters of an upstream error body that can carry
  organisation and project identifiers. No credential, token or password is
  logged. The trade is judged worthwhile — a server log is a far narrower
  audience than every visitor's browser — but it is a trade, not a free win.
