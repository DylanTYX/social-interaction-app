# Deploy ConvoTrainer to Vercel

This guide connects your existing GitHub repo to Vercel and configures Supabase for production auth.

**Repo:** `https://github.com/DylanTYX/social-interaction-app`  
**Stack:** Next.js 16 · Supabase · OpenAI (optional Azure Speech for voice)

---

## Part A — Supabase (production database + auth)

Do this **before** or **right after** the first Vercel deploy. Use the **same** Supabase project you use locally, or create a dedicated production project.

### A1. Apply database migrations

In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**, run each file **in order**:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_job_descriptions.sql`
3. `supabase/migrations/0003_table_privileges.sql`
4. `supabase/migrations/0004_resumes.sql`
5. `supabase/migrations/0005_atomic_turns_and_preset_uniqueness.sql`
6. `supabase/migrations/0006_turn_analyses.sql`
7. `supabase/migrations/0007_llm_usage.sql`
8. `supabase/migrations/0008_resume_profile.sql`

> **`0005` and `0006` are not optional.** Together they create the
> `append_interview_turn` RPC that `src/lib/db/sessions.ts` calls on every
> interview turn — `0006` replaces the signature `0005` introduced. Skip either
> and the app deploys cleanly but fails the moment anyone sends a message.

(Or use Supabase CLI: `supabase db push` if you have the project linked.)

### A2. Copy API keys

**Project Settings → API:**

| Variable | Where to copy |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` public key **or** `sb_publishable_…` publishable key |

Keep `SUPABASE_SERVICE_ROLE_KEY` secret — only add to Vercel if you use server-admin features.

### A3. Auth URL configuration (required for login on Vercel)

**Authentication → URL Configuration:**

| Field | Value |
|-------|--------|
| **Site URL** | `https://YOUR-APP.vercel.app` (your production URL after first deploy) |
| **Redirect URLs** | Add all of these (one per line): |

```
https://YOUR-APP.vercel.app/**
http://localhost:3000/**
https://*.vercel.app/**
```

The `*.vercel.app` entry covers preview deployments. Replace `YOUR-APP` with your actual production hostname after deploy.

**Authentication → Providers → Email:** ensure Email provider is enabled if you use email/password sign-up.

---

## Part B — Vercel project (GitHub)

### B1. Create account & import

1. Go to [vercel.com](https://vercel.com) and sign in with **GitHub**.
2. **Add New… → Project**.
3. Import **`DylanTYX/social-interaction-app`**.
4. Framework preset should be **Next.js** (auto-detected).
5. **Root Directory:** leave as `.` (repo root).
6. **Build Command:** `npm run build` (default).
7. **Install Command:** `npm install` (default).

Do **not** deploy yet — add environment variables first (next section).

### B2. Environment variables

**Project → Settings → Environment Variables.**  
Add these for **Production** (and **Preview** if family will test preview URLs):

| Name | Required | Notes |
|------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | From Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon or publishable key |
| `OPENAI_API_KEY` | Yes | For interviews, scoring, coach |
| `AZURE_SPEECH_KEY` | No | Only for **voice** interviews |
| `AZURE_SPEECH_REGION` | No | e.g. `eastus` |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-only; only if needed |

Optional model overrides (leave unset unless you want to change models):

- `INTERVIEWER_MODEL`, `INTERVIEWER_OPENING_MODEL`, `ANALYZER_MODEL`, `COACH_MODEL`

**Tip:** Copy values from your local `.env.local` — never commit that file.

### B3. Deploy

1. Click **Deploy** (or push to `main` if you connected Git integration).
2. Wait for the build to finish (should match local `npm run build`).
3. Open the production URL, e.g. `https://social-interaction-app.vercel.app`.

### B4. Update Supabase Site URL

After you know the final hostname, go back to **Supabase → Auth → URL Configuration** and set **Site URL** to that exact URL.

---

## Part C — Post-deploy smoke test

On the **production** URL:

| Step | Check |
|------|--------|
| 1 | Landing page loads |
| 2 | **See it in action** scrolls to “See your score in 10 seconds” |
| 3 | Register a new account |
| 4 | Dashboard loads (not stuck on login) |
| 5 | Start a **text** interview → send one answer → end → report opens |

If step 3–4 fail: almost always **Supabase redirect URLs** or missing env vars. Check Vercel **Deployments → Functions** logs for errors.

---

## Part D — Ongoing deploys

- **Production:** every push to `main` auto-deploys (default Git integration).
- **Preview:** every PR/branch gets a unique `*.vercel.app` URL.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Build fails on Vercel | Run `npm run build` locally; fix TypeScript errors first |
| “Supabase is not configured” | Add `NEXT_PUBLIC_SUPABASE_*` in Vercel env; redeploy |
| Login works locally, not on Vercel | Add production URL to Supabase **Redirect URLs** |
| Register succeeds but dashboard redirects to login | Same as above; check cookies / Site URL |
| AI never responds | `OPENAI_API_KEY` missing or invalid; check function logs |
| Voice broken | Add `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` |
| PDF upload fails | Migrations `0002`/`0004` not applied on production DB |
| Sending a message 500s | Migrations `0005`/`0006` not applied — `append_interview_turn` RPC is missing or has the old signature |
| Report shows scores but no per-question detail | Migration `0006` not applied — analyses are not being persisted |
| Resume context looks truncated | Migration `0008` not applied — falls back to raw text, which still works |
| New account has every preset persona twice | Migration `0005` not applied — the unique index is missing |
| API timeout (~10s) on Hobby | Rare for streaming chat; if analyze route times out, retry or upgrade plan |

---

## Cost reminder (Hobby)

| Service | Typical UAT cost |
|---------|------------------|
| Vercel Hobby | $0 |
| Supabase Free | $0 within limits |
| OpenAI | Pay per use — set a **usage limit** in OpenAI dashboard |

---

## Optional: Vercel CLI (from your machine)

```bash
npm i -g vercel
cd /path/to/social-interaction-app
vercel login
vercel link          # link to existing project or create new
vercel env pull .env.vercel.local   # optional: pull env for local preview
vercel --prod        # deploy production
```

CLI is optional; the GitHub dashboard flow above is enough.

---

## Checklist (printable)

- [ ] Migrations `0001`–`0008` applied on Supabase
- [ ] Vercel project imported from GitHub
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `OPENAI_API_KEY` set
- [ ] Production deploy green
- [ ] Supabase Site URL + Redirect URLs updated
- [ ] Smoke test: register → dashboard → one text interview → report
- [ ] UAT handout updated with live URL (`docs/UAT-tester-handout.md`)
