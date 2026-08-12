-- ---------------------------------------------------------------------------
-- Integrity at the data layer
-- ---------------------------------------------------------------------------
--
-- Every rule below was previously enforced only in TypeScript, in a route
-- handler. That is a real gap and not only a theoretical one: `0003` grants
-- `select, insert, update, delete` on these tables to `authenticated`, and the
-- browser holds the anon key plus a live session. RLS decides *whose rows* a
-- statement may touch; it says nothing about *which columns* or *what values*.
-- So `parseScore`'s 0-100 clamp, `parseDurationMinutes`'s 0-1440 clamp and the
-- five-value `call_site` vocabulary were all advisory.
--
-- These constraints close the value half of that gap for every writer,
-- including a direct PostgREST call and including a future bug in our own code.
--
-- The *column* half — stopping a client writing `summary`, `launch_meta` or
-- `average_score` at all — is deliberately NOT addressed here. Column-level
-- grants cannot express it: the API routes act through the same `authenticated`
-- role and the same JWT as the browser would, so any grant that lets
-- `/api/chat` write `summary` also lets the console do it. Closing it properly
-- means routing server-owned writes through `security definer` functions the
-- way `append_interview_turn` already does. That is a larger change, and every
-- impact today is self-scoped — RLS still confines a forged write to the
-- forger's own rows, so there is no cross-tenant escalation. Tracked as
-- follow-up rather than pretended away.
--
-- `not valid` throughout: these are added to a table that already has rows, and
-- a migration that fails on historical data helps nobody. New and updated rows
-- are checked immediately; run `validate constraint` once the existing data is
-- known to be clean.

-- --------------------------------------------------------------------------
-- interview_sessions
-- --------------------------------------------------------------------------

alter table interview_sessions
  drop constraint if exists interview_sessions_average_score_range;
alter table interview_sessions
  add constraint interview_sessions_average_score_range
  check (average_score is null or (average_score >= 0 and average_score <= 100))
  not valid;

alter table interview_sessions
  drop constraint if exists interview_sessions_duration_range;
alter table interview_sessions
  add constraint interview_sessions_duration_range
  check (
    duration_minutes is null
    or (duration_minutes >= 0 and duration_minutes <= 1440)
  )
  not valid;

alter table interview_sessions
  drop constraint if exists interview_sessions_turn_count_non_negative;
alter table interview_sessions
  add constraint interview_sessions_turn_count_non_negative
  check (turn_count >= 0)
  not valid;

-- --------------------------------------------------------------------------
-- interview_turn_analyses
-- --------------------------------------------------------------------------

alter table interview_turn_analyses
  drop constraint if exists turn_analyses_overall_score_range;
alter table interview_turn_analyses
  add constraint turn_analyses_overall_score_range
  check (overall_score is null or (overall_score >= 0 and overall_score <= 100))
  not valid;

alter table interview_turn_analyses
  drop constraint if exists turn_analyses_confidence_range;
alter table interview_turn_analyses
  add constraint turn_analyses_confidence_range
  check (confidence is null or (confidence >= 0 and confidence <= 100))
  not valid;

alter table interview_turn_analyses
  drop constraint if exists turn_analyses_turn_index_non_negative;
alter table interview_turn_analyses
  add constraint turn_analyses_turn_index_non_negative
  check (turn_index >= 0)
  not valid;

-- --------------------------------------------------------------------------
-- llm_usage
--
-- The table the cost reporting is built on, and the one where a bad value is
-- least visible: `llm_usage_summary` averages whatever is here, so a single
-- negative or absurd row moves a number that is presented as measured fact.
-- --------------------------------------------------------------------------

alter table llm_usage
  drop constraint if exists llm_usage_call_site_known;
alter table llm_usage
  add constraint llm_usage_call_site_known
  check (
    call_site in (
      'interviewer',
      'analyzer',
      'summary',
      'embedding',
      'coach',
      'resume-profile'
    )
  )
  not valid;

alter table llm_usage
  drop constraint if exists llm_usage_tokens_non_negative;
alter table llm_usage
  add constraint llm_usage_tokens_non_negative
  -- Deliberately only non-negativity. `cached_tokens <= prompt_tokens` is true
  -- of every OpenAI response we have seen, but `usage.flush` is best-effort and
  -- swallows its own errors — so a constraint the provider ever disagrees with
  -- would silently discard accounting rather than fail loudly.
  check (
    prompt_tokens >= 0
    and completion_tokens >= 0
    and cached_tokens >= 0
  )
  not valid;

-- --------------------------------------------------------------------------
-- coach_answers
-- --------------------------------------------------------------------------

alter table coach_answers
  drop constraint if exists coach_answers_turn_index_non_negative;
alter table coach_answers
  add constraint coach_answers_turn_index_non_negative
  check (turn_index >= 0)
  not valid;

-- --------------------------------------------------------------------------
-- Indexes for predicates the session list filters on every request
--
-- `listSessions` filters on `practice_mode` and `status` and asks for
-- `count: "exact"`, which means the filtered set is aggregated in full on every
-- call. The only index was `(user_id, created_at desc)`.
-- --------------------------------------------------------------------------

create index if not exists sessions_user_mode_idx
  on interview_sessions (user_id, practice_mode, created_at desc);

create index if not exists sessions_user_status_idx
  on interview_sessions (user_id, status, created_at desc);

-- The search is two leading-wildcard `ilike`s under an `or`, which no b-tree
-- can serve — that is a sequential scan per keystroke, twice over because of
-- the exact count.
create extension if not exists pg_trgm;

create index if not exists sessions_scenario_title_trgm_idx
  on interview_sessions using gin (scenario_title gin_trgm_ops);

create index if not exists sessions_persona_name_trgm_idx
  on interview_sessions using gin (persona_name gin_trgm_ops);

-- --------------------------------------------------------------------------
-- Replace the degenerate vector index
--
-- `0002` builds an ivfflat index on an empty table. ivfflat derives its cluster
-- centroids at build time, so one built on zero rows is degenerate and recall
-- for `match_job_description_chunks` stays arbitrary no matter how much data
-- lands later. HNSW builds incrementally and has no such failure mode.
-- --------------------------------------------------------------------------

drop index if exists job_description_chunks_embedding_idx;

create index if not exists job_description_chunks_embedding_hnsw_idx
  on job_description_chunks using hnsw (embedding vector_cosine_ops);

-- --------------------------------------------------------------------------
-- Pin the search path on the one function that was missing it
--
-- `append_interview_turn` and `llm_usage_summary` both set it; this one takes a
-- user-supplied vector and did not.
-- --------------------------------------------------------------------------

alter function match_job_description_chunks(vector, int, uuid)
  set search_path = public;
