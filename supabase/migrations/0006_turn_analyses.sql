-- Persist the per-turn analysis that the app already pays to generate.
--
-- Apply after 0005_atomic_turns_and_preset_uniqueness.sql.
--
-- Today `/api/chat` runs a full rubric over every substantive answer, uses it
-- to steer the next question, returns it to the client for the live coaching
-- panel — and then drops it. Only a rolled-up average and a handful of
-- dimension snapshots reach Postgres. Consequences:
--
--   * the session report can only show aggregate numbers, never per-question
--     strengths/gaps or the STAR/technical breakdown that was computed;
--   * `decideInterviewAction`'s anti-repetition path is dead, because nothing
--     remembers which strategy the previous turn used;
--   * there is no data to evaluate scoring quality against.
--
-- Storing it costs one insert on a write we were already making.

-- ---------------------------------------------------------------------------
-- interview_turn_analyses
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
  -- One analysis per scored turn; makes the RPC idempotent under retry.
  unique (session_id, turn_index)
);

create index if not exists turn_analyses_session_idx
  on interview_turn_analyses(session_id, turn_index);

-- ---------------------------------------------------------------------------
-- Row Level Security — ownership is derived from the parent session, matching
-- the shape of `messages_owner_all` in 0001_init.sql.
-- ---------------------------------------------------------------------------
alter table interview_turn_analyses enable row level security;

drop policy if exists "turn_analyses_owner_all" on interview_turn_analyses;
create policy "turn_analyses_owner_all" on interview_turn_analyses
  for all
  using (
    exists (
      select 1 from interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on table interview_turn_analyses
  to authenticated;

-- ---------------------------------------------------------------------------
-- Extend append_interview_turn to write the analysis in the same transaction
-- ---------------------------------------------------------------------------
--
-- The old three-argument function must be dropped, not replaced: adding
-- parameters with defaults would create an overload, and a three-argument call
-- would then match both signatures and fail with "function is not unique".
drop function if exists append_interview_turn(uuid, text, text);

/**
 * Append one interview turn, bump `turn_count`, and record the analysis of the
 * user's answer — atomically.
 *
 * `p_user_content` is null for the opening turn, where the interviewer speaks
 * first and there is nothing to score.
 *
 * The analysis parameters are optional: trivial answers ("yes", "ready") and
 * turns where the analyzer failed are persisted as messages with no analysis
 * row, rather than blocking the reply.
 *
 * The `for update` on the session row serializes concurrent turns — a second
 * caller blocks until the first commits, then derives its index from committed
 * state. Invoker rights, so RLS still applies on every table touched.
 */
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
security invoker
set search_path = public
as $$
declare
  current_turn int;
  next_turn int;
  user_turn int;
  user_message_id uuid;
begin
  select turn_count into current_turn
  from interview_sessions
  where id = p_session_id
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
  set turn_count = next_turn
  where id = p_session_id;

  return next_turn;
end;
$$;

grant execute on function append_interview_turn(
  uuid, text, text, jsonb, text, int, text, int
) to authenticated;
