-- ConvoTrainer database, part 3 of 3: the functions the app calls.
--
-- Run after 0002_security.sql.
--
-- Three of these are `security definer`: they run with the owner's privileges
-- and bypass RLS, because they write what 0002_security.sql does not let
-- `authenticated` write directly. That is the point and also the hazard, so
-- each one filters on `user_id = auth.uid()` itself and none accepts a user id
-- from its caller.
--
-- plpgsql resolves column names when a statement runs, not when the function
-- is created, so a function naming a column 0001_schema.sql lacks is created
-- without complaint and fails on every call. `src/lib/db/migrations.test.ts`
-- checks the columns these bodies write against the schema file.

-- ---------------------------------------------------------------------------
-- Job-description retrieval
--
-- Invoker rights, so RLS applies, and the explicit `auth.uid()` filter keeps a
-- candidate's chunks under the same rule as everything else.
-- ---------------------------------------------------------------------------
create or replace function match_job_description_chunks(
  query_embedding vector(1536),
  match_count int,
  filter_job_description_id uuid
)
returns table (
  id uuid,
  job_description_id uuid,
  content text,
  chunk_index int,
  similarity float
)
language sql
stable
set search_path = public
as $$
  select
    c.id,
    c.job_description_id,
    c.content,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) as similarity
  from job_description_chunks c
  where
    c.job_description_id = filter_job_description_id
    and c.user_id = auth.uid()
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 8));
$$;

grant execute on function match_job_description_chunks(vector, int, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Interview turns
--
-- Appends one turn, bumps `turn_count`, and records the analysis of the user's
-- answer, in one transaction. Called on every interview turn.
--
-- `p_user_content` is null for the opening turn, where the interviewer speaks
-- first and there is nothing to score. The analysis parameters are optional:
-- trivial answers ("yes", "ready") and turns where the analyzer failed are kept
-- as messages with no analysis row, rather than blocking the reply.
--
-- The `for update` on the session row serialises concurrent turns: a second
-- caller blocks until the first commits, then derives its indices from
-- committed state instead of writing duplicates.
-- ---------------------------------------------------------------------------
create or replace function append_interview_turn(
  p_session_id uuid,
  p_user_content text,
  p_assistant_content text,
  p_analysis jsonb default null,
  p_round_type text default null,
  p_overall_score int default null,
  p_strategy text default null,
  p_confidence int default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  current_turn int;
  next_turn int;
  user_turn int;
  user_message_id uuid;
begin
  -- The `user_id` filter is what RLS would have supplied. It must stay for as
  -- long as this function is `security definer`.
  select turn_count into current_turn
  from interview_sessions
  where id = p_session_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Session % not found or not accessible', p_session_id
      using errcode = 'no_data_found';
  end if;

  if p_user_content is null then
    next_turn := current_turn + 1;
    insert into interview_messages (session_id, role, content, turn_index)
    values (p_session_id, 'assistant', p_assistant_content, next_turn);
  else
    user_turn := current_turn + 1;
    next_turn := current_turn + 2;

    insert into interview_messages (session_id, role, content, turn_index)
    values (p_session_id, 'user', p_user_content, user_turn)
    returning id into user_message_id;

    insert into interview_messages (session_id, role, content, turn_index)
    values (p_session_id, 'assistant', p_assistant_content, next_turn);

    if p_analysis is not null then
      insert into interview_turn_analyses (
        session_id, message_id, turn_index, round_type,
        overall_score, strategy, confidence, analysis
      )
      values (
        p_session_id, user_message_id, user_turn, p_round_type,
        p_overall_score, p_strategy, p_confidence, p_analysis
      )
      on conflict (session_id, turn_index) do nothing;
    end if;
  end if;

  update interview_sessions
  set turn_count = next_turn, updated_at = now()
  where id = p_session_id;

  return next_turn;
end;
$$;

revoke all on function append_interview_turn(
  uuid, text, text, jsonb, text, int, text, int
) from public;
grant execute on function append_interview_turn(
  uuid, text, text, jsonb, text, int, text, int
) to authenticated;

-- ---------------------------------------------------------------------------
-- Every other session write after creation
--
-- One jsonb patch rather than a long parameter list, so "key absent" (leave
-- the column alone) and "key present and null" (clear it) stay distinguishable
-- — a null `ended_at` or `notes` is a real value.
-- ---------------------------------------------------------------------------
create or replace function update_session_progress(
  p_session_id uuid,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update interview_sessions set
    status = case
      when p_patch ? 'status' then p_patch ->> 'status' else status end,
    summary = case
      when p_patch ? 'summary' then p_patch ->> 'summary' else summary end,
    metrics = case
      when p_patch ? 'metrics' then p_patch -> 'metrics' else metrics end,
    launch_meta = case
      when p_patch ? 'launch_meta' then p_patch -> 'launch_meta'
      else launch_meta end,
    loop_id = case
      when p_patch ? 'loop_id' then (p_patch ->> 'loop_id')::uuid
      else loop_id end,
    loop_progress = case
      when p_patch ? 'loop_progress' then p_patch -> 'loop_progress'
      else loop_progress end,
    competency_coverage = case
      when p_patch ? 'competency_coverage' then p_patch -> 'competency_coverage'
      else competency_coverage end,
    average_score = case
      when p_patch ? 'average_score' then (p_patch ->> 'average_score')::int
      else average_score end,
    duration_minutes = case
      when p_patch ? 'duration_minutes'
        then (p_patch ->> 'duration_minutes')::int
      else duration_minutes end,
    ended_at = case
      when p_patch ? 'ended_at' then (p_patch ->> 'ended_at')::timestamptz
      else ended_at end,
    title = case
      when p_patch ? 'title' then p_patch ->> 'title' else title end,
    tags = case
      when p_patch ? 'tags'
        then coalesce(array(select jsonb_array_elements_text(p_patch -> 'tags')), '{}')
      else tags end,
    pinned = case
      when p_patch ? 'pinned' then (p_patch ->> 'pinned')::boolean
      else pinned end,
    notes = case
      when p_patch ? 'notes' then p_patch ->> 'notes' else notes end,
    archived_at = case
      when p_patch ? 'archived_at' then (p_patch ->> 'archived_at')::timestamptz
      else archived_at end
  -- The ownership check RLS would have done. Without it, `security definer`
  -- would let any authenticated caller patch any session by id.
  where id = p_session_id and user_id = auth.uid();

  if not found then
    raise exception 'Session % not found or not accessible', p_session_id
      using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function update_session_progress(uuid, jsonb) from public;
grant execute on function update_session_progress(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Token accounting
-- ---------------------------------------------------------------------------
create or replace function record_llm_usage(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into llm_usage (
    user_id, session_id, call_site, model,
    prompt_tokens, completion_tokens, cached_tokens
  )
  select
    -- Never from the caller: the row is attributed to whoever is signed in.
    auth.uid(),
    case
      when row_data ->> 'session_id' is null then null
      else (row_data ->> 'session_id')::uuid
    end,
    row_data ->> 'call_site',
    row_data ->> 'model',
    coalesce((row_data ->> 'prompt_tokens')::int, 0),
    coalesce((row_data ->> 'completion_tokens')::int, 0),
    coalesce((row_data ->> 'cached_tokens')::int, 0)
  from jsonb_array_elements(p_rows) as row_data;
end;
$$;

revoke all on function record_llm_usage(jsonb) from public;
grant execute on function record_llm_usage(jsonb) to authenticated;

-- Per-call-site averages for the signed-in user, optionally since a cutoff:
--
--   select * from llm_usage_summary(null);
--   select * from llm_usage_summary('2026-07-27'::timestamptz);
--
-- `auth.uid()` is null for the SQL editor's `postgres` role, so there it
-- returns nothing; query `llm_usage` directly instead.
create or replace function llm_usage_summary(p_since timestamptz default null)
returns table (
  call_site text,
  model text,
  calls bigint,
  avg_prompt_tokens numeric,
  avg_completion_tokens numeric,
  avg_cached_tokens numeric,
  total_prompt_tokens bigint,
  total_completion_tokens bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    u.call_site,
    u.model,
    count(*) as calls,
    round(avg(u.prompt_tokens), 1) as avg_prompt_tokens,
    round(avg(u.completion_tokens), 1) as avg_completion_tokens,
    round(avg(u.cached_tokens), 1) as avg_cached_tokens,
    sum(u.prompt_tokens) as total_prompt_tokens,
    sum(u.completion_tokens) as total_completion_tokens
  from llm_usage u
  where u.user_id = auth.uid()
    and (p_since is null or u.created_at >= p_since)
  group by u.call_site, u.model
  order by sum(u.prompt_tokens) desc;
$$;

grant execute on function llm_usage_summary(timestamptz) to authenticated;
