-- ConvoTrainer database, part 1 of 3: tables, constraints, indexes, triggers.
--
-- Run the three files in this folder in order, in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query), against a new project:
--
--   0001_schema.sql     tables, constraints, indexes, triggers
--   0002_security.sql   row-level security and table privileges
--   0003_functions.sql  the functions the app calls, and who may call them
--
-- These replace eighteen incremental migrations (`0001_init` through
-- `0018_session_management`, still in git history at df74b64). They build the
-- same end state, written directly, so what only existed to move an older
-- database forward is gone: duplicate-row clean-ups, JSONB backfills, a vector
-- index that was later replaced, superseded function signatures, and privileges
-- granted in one file and revoked in a later one. A database that has already
-- run the eighteen needs nothing from here.
--
-- Every statement is guarded (`if not exists`, `drop … if exists`, `create or
-- replace`), so running a file twice is harmless.
--
-- Constraints are declared inline and so are validated. The eighteen added
-- most of them later as `not valid`, to avoid re-checking rows that predated
-- them; a new database has no such rows.

create extension if not exists "pgcrypto";
create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- updated_at trigger function, shared by every table that has the column
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- personas
-- ---------------------------------------------------------------------------
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('preset', 'user')),
  name text not null,
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personas_user_idx on personas(user_id, updated_at desc);

-- The built-in presets are seeded on first load. Two concurrent first loads
-- (two tabs, or the library and the setup wizard) would otherwise both see an
-- empty table and give a new user every preset twice.
create unique index if not exists personas_user_preset_name_idx
  on personas(user_id, name)
  where kind = 'preset';

drop trigger if exists personas_set_updated_at on personas;
create trigger personas_set_updated_at
  before update on personas
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- job_descriptions, and the embedded chunks retrieval searches
-- ---------------------------------------------------------------------------
create table if not exists job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  role_title text,
  company text,
  source_url text,
  -- Library-only: never read into the interviewer's prompt.
  notes text,
  source_type text not null default 'text' check (source_type in ('text')),
  raw_text text not null,
  -- The original length when an upload exceeded the cap. Null means stored whole.
  truncated_from integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_descriptions_user_idx
  on job_descriptions(user_id, created_at desc);

-- Backs the library's company filter. `user_id` leads because RLS scopes every
-- read to one user.
create index if not exists job_descriptions_user_company_idx
  on job_descriptions(user_id, company);

drop trigger if exists job_descriptions_set_updated_at on job_descriptions;
create trigger job_descriptions_set_updated_at
  before update on job_descriptions
  for each row execute function set_updated_at();

create table if not exists job_description_chunks (
  id uuid primary key default gen_random_uuid(),
  job_description_id uuid not null references job_descriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_estimate int not null default 0,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique(job_description_id, chunk_index)
);

create index if not exists job_description_chunks_job_idx
  on job_description_chunks(job_description_id, chunk_index);

-- HNSW rather than ivfflat. ivfflat fixes its cluster centroids when the index
-- is built, and an index built on an empty table (which any migration's is)
-- stays degenerate however much data arrives later. HNSW builds incrementally.
create index if not exists job_description_chunks_embedding_hnsw_idx
  on job_description_chunks using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- resumes
--
-- Short enough to fit in the prompt whole, so only the extracted text is
-- stored — no chunks, no embeddings.
-- ---------------------------------------------------------------------------
create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  -- "PM version", "backend version". Library-only, like `notes`.
  variant text,
  notes text,
  source_type text not null default 'text' check (source_type in ('text')),
  raw_text text not null,
  -- A distilled summary the interviewer once read instead of the raw text. No
  -- longer read or written; kept so this schema matches existing databases.
  profile text,
  truncated_from integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resumes_user_idx
  on resumes(user_id, created_at desc);

drop trigger if exists resumes_set_updated_at on resumes;
create trigger resumes_set_updated_at
  before update on resumes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- session_folders
--
-- Created before interview_sessions, which references it.
-- ---------------------------------------------------------------------------
create table if not exists session_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_folders_name_length
    check (char_length(btrim(name)) between 1 and 60)
);

-- One "Acme" per user, however it is capitalised.
create unique index if not exists session_folders_user_name_idx
  on session_folders (user_id, lower(name));

drop trigger if exists session_folders_set_updated_at on session_folders;
create trigger session_folders_set_updated_at
  before update on session_folders
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- interview_sessions
-- ---------------------------------------------------------------------------
create table if not exists interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_mode text not null check (practice_mode in ('text', 'voice')),
  scenario_value text not null,
  -- Read into the interviewer's prompt. The candidate's own name for the
  -- session is `title`, so renaming never changes what the interviewer is told.
  scenario_title text,
  scenario_description text,
  persona_id uuid references personas(id) on delete set null,
  persona_name text not null,
  persona_config jsonb not null,
  job_description_id uuid references job_descriptions(id) on delete set null,
  resume_id uuid references resumes(id) on delete set null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  -- Rolling summary maintained server-side. Sent to the model each turn instead
  -- of the full transcript so token usage stays bounded.
  summary text,
  turn_count int not null default 0,
  -- The client's rolling score metrics. The server-owned parts live in their
  -- own columns below, so two writers cannot overwrite each other's keys.
  metrics jsonb,
  launch_meta jsonb,
  loop_id uuid,
  loop_progress jsonb,
  competency_coverage jsonb,
  average_score int,
  duration_minutes int,
  -- Organisation, all written through update_session_progress.
  title text,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  notes text,
  archived_at timestamptz,
  folder_id uuid references session_folders(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interview_sessions_average_score_range check (average_score is null or (average_score >= 0 and average_score <= 100)),
  constraint interview_sessions_duration_range check (duration_minutes is null or (duration_minutes >= 0 and duration_minutes <= 1440)),
  constraint interview_sessions_turn_count_non_negative check (turn_count >= 0),
  constraint interview_sessions_title_length check (title is null or char_length(title) between 1 and 120),
  constraint interview_sessions_notes_length check (notes is null or char_length(notes) <= 4000),
  constraint interview_sessions_tag_count check (cardinality(tags) <= 12)
);

create index if not exists sessions_user_idx
  on interview_sessions(user_id, created_at desc);
create index if not exists sessions_job_description_idx
  on interview_sessions(job_description_id);
create index if not exists sessions_resume_idx
  on interview_sessions(resume_id);

-- The loop report asks for its rounds by loop id.
create index if not exists sessions_loop_idx
  on interview_sessions(loop_id, created_at)
  where loop_id is not null;

-- The session list filters on mode and status with an exact count, so the
-- filtered set is aggregated in full on every request.
create index if not exists sessions_user_mode_idx
  on interview_sessions (user_id, practice_mode, created_at desc);
create index if not exists sessions_user_status_idx
  on interview_sessions (user_id, status, created_at desc);

-- Search is a leading-wildcard `ilike`, which no b-tree can serve.
create index if not exists sessions_scenario_title_trgm_idx
  on interview_sessions using gin (scenario_title gin_trgm_ops);
create index if not exists sessions_persona_name_trgm_idx
  on interview_sessions using gin (persona_name gin_trgm_ops);

create index if not exists sessions_tags_idx
  on interview_sessions using gin (tags);
create index if not exists sessions_user_folder_idx
  on interview_sessions (user_id, folder_id);
create index if not exists sessions_user_pinned_idx
  on interview_sessions (user_id, pinned, created_at desc);

drop trigger if exists interview_sessions_set_updated_at on interview_sessions;
create trigger interview_sessions_set_updated_at
  before update on interview_sessions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- interview_messages
-- ---------------------------------------------------------------------------
create table if not exists interview_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  turn_index int not null,
  created_at timestamptz not null default now(),
  -- Backstop for append_interview_turn, which assigns indices under a row lock.
  constraint interview_messages_session_turn_key unique (session_id, turn_index)
);

create index if not exists messages_session_idx
  on interview_messages(session_id, turn_index);

-- ---------------------------------------------------------------------------
-- interview_turn_analyses: the per-answer rubric result, kept for the report
-- ---------------------------------------------------------------------------
create table if not exists interview_turn_analyses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  -- The user message this analysis scores. `set null` rather than cascade so a
  -- message deletion does not silently erase evaluation data.
  message_id uuid references interview_messages(id) on delete set null,
  -- turn_index of the scored user message, mirroring interview_messages.
  turn_index int not null,
  round_type text,
  overall_score int,
  strategy text,
  confidence int,
  -- The full AnalysisResult, including the raw analyzer text.
  analysis jsonb not null,
  created_at timestamptz not null default now(),
  -- One analysis per scored turn; makes the insert idempotent under retry.
  unique (session_id, turn_index),
  constraint turn_analyses_overall_score_range check (overall_score is null or (overall_score >= 0 and overall_score <= 100)),
  constraint turn_analyses_confidence_range check (confidence is null or (confidence >= 0 and confidence <= 100)),
  constraint turn_analyses_turn_index_non_negative check (turn_index >= 0)
);

create index if not exists turn_analyses_session_idx
  on interview_turn_analyses(session_id, turn_index);

-- ---------------------------------------------------------------------------
-- coach_answers: generated suggested answers, so a report opened twice is
-- billed once. Quick Drills do not use it — a drill has no session or turn.
-- ---------------------------------------------------------------------------
create table if not exists coach_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  turn_index int not null,
  -- The rubric the answer was written against, as actually used.
  round_type text,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  -- One cached answer per turn, so two tabs cannot write duplicates.
  unique (session_id, turn_index),
  constraint coach_answers_turn_index_non_negative check (turn_index >= 0)
);

create index if not exists coach_answers_session_idx
  on coach_answers(session_id, turn_index);

comment on column coach_answers.answer is
  '{ suggestedAnswer, rewrite, tips[] } — the response of POST /api/coach/suggested-answer, verbatim.';

-- ---------------------------------------------------------------------------
-- llm_usage: one row per model call, written best-effort
-- ---------------------------------------------------------------------------
create table if not exists llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Null for calls not tied to a session (document processing at upload).
  session_id uuid references interview_sessions(id) on delete set null,
  -- Which logical call this was, so a turn can be costed by component.
  call_site text not null,
  model text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  -- Subset of prompt_tokens served from OpenAI's prompt cache at a discount.
  cached_tokens int not null default 0,
  created_at timestamptz not null default now(),
  -- A new kind of model call needs its name added here, or its rows are rejected.
  constraint llm_usage_call_site_known check (call_site in ('interviewer', 'analyzer', 'summary', 'embedding', 'coach', 'resume-profile', 'jd-clean')),
  -- Only non-negativity. `cached_tokens <= prompt_tokens` holds for every
  -- response seen so far, but recording swallows its own errors, so a rule the
  -- provider ever disagreed with would silently discard accounting.
  constraint llm_usage_tokens_non_negative check (prompt_tokens >= 0 and completion_tokens >= 0 and cached_tokens >= 0)
);

create index if not exists llm_usage_user_idx on llm_usage(user_id, created_at desc);
create index if not exists llm_usage_session_idx on llm_usage(session_id, created_at);
