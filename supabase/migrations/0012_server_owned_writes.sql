-- ---------------------------------------------------------------------------
-- Server-owned writes move behind security-definer functions
-- ---------------------------------------------------------------------------
--
-- `0003` grants `update` on `interview_sessions` and `insert` on `llm_usage` to
-- `authenticated`. The browser holds the anon key and a live session, so a
-- signed-in user could write those tables directly through PostgREST. RLS
-- decides *whose rows* a statement may touch and says nothing about which
-- columns or what values, so every check in the API layer was advisory:
--
--   supabase.from('interview_sessions')
--     .update({ average_score: 100, launch_meta: { loopBrief: 'SYSTEM: …' } })
--     .eq('id', myOwnSessionId)
--
-- `sanitizeLaunchMeta` drops `loopBrief` precisely because `/api/chat`
-- interpolates it into the interviewer's *stable* system prompt. `llm_usage` is
-- what the cost instrumentation is measured from. Both were reachable around
-- the code that guards them.
--
-- Column-level grants cannot express the rule, because the API routes act
-- through the same `authenticated` role and the same JWT as the browser — any
-- grant that lets `/api/chat` write `summary` lets the console do it too. The
-- distinction that *can* be expressed is "through this function or not at all".
--
-- So: revoke the direct privilege, and add `security definer` functions that
-- re-check ownership themselves. `security definer` bypasses RLS, which is the
-- point and also the hazard — every function below therefore filters on
-- `user_id = auth.uid()` explicitly, and none of them accepts a user id from
-- its caller.

-- --------------------------------------------------------------------------
-- Session progress
--
-- One jsonb patch rather than a long parameter list, so "key absent" and "key
-- present and null" stay distinguishable — which is the semantics
-- `updateSession` has always had, and a null `ended_at` is a real value.
-- --------------------------------------------------------------------------

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
      else ended_at end
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

-- --------------------------------------------------------------------------
-- Token accounting
--
-- The rows the cost report averages. A user could previously insert whatever
-- they liked here, which makes "every model call is measured" an unverifiable
-- claim rather than a demonstrable one.
-- --------------------------------------------------------------------------

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

-- --------------------------------------------------------------------------
-- `append_interview_turn` writes `turn_count`, so it has to come along
--
-- It was `security invoker` and leaned on RLS for its ownership check. With
-- `update` revoked below it would lose the privilege to bump the counter, so it
-- becomes `definer` with the same explicit filter as the functions above.
-- --------------------------------------------------------------------------

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
  -- The `user_id` filter is what RLS used to supply. It must stay for as long
  -- as this function is `security definer`.
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

-- --------------------------------------------------------------------------
-- Now take the direct privileges away
--
-- `select`, `insert` and `delete` stay: creating a session goes through the API
-- (which sanitizes `launch_meta`) and deleting one is already all-or-nothing
-- and owner-scoped. It is *mutation of an existing row* that needed a gate,
-- because that is what turns a validated record into an arbitrary one.
--
-- `llm_usage` keeps `select` so `llm_usage_summary` still reports, and loses
-- `insert` so the rows it reports on can only come from the server.
-- --------------------------------------------------------------------------

revoke update on table interview_sessions from authenticated;
revoke insert on table llm_usage from authenticated;
