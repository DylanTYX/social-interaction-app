-- Cache for coach model answers, so opening a report twice costs once.
--
-- Apply after 0009_session_columns.sql.
--
-- `POST /api/coach/model-answer` generates an exemplary answer, a rewrite of
-- the candidate's own answer, and a few tips. The result was held in React
-- state and nowhere else (`report/[id]/page.tsx`), so every reload, every
-- back-navigation, and every second visit to a report regenerated all of them
-- at full price for identical input. Nothing about a completed turn changes,
-- so this is the clearest case in the app of paying repeatedly to be told the
-- same thing.
--
-- Keyed `(session_id, turn_index)` rather than on a hash of the text. The turn
-- is the thing being coached, the pair is already the unique key used by both
-- `interview_messages` (0005) and `interview_turn_analyses` (0006), and both
-- are assigned deterministically inside the row-locked `append_interview_turn`
-- RPC — so they are stable, not derived from read-time ordering.
--
-- The drills page deliberately does not write here. Drills have no session, and
-- each submitted answer is new free text, so the hit rate would be ~0 and a
-- content-hash key would cost an index for nothing.

create table if not exists coach_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  turn_index int not null,
  -- Which rubric the answer was written against. A round can be re-typed in
  -- theory, so this records what was actually used rather than re-deriving it.
  round_type text,
  -- { modelAnswer, rewrite, tips[] } — the route's response shape verbatim.
  answer jsonb not null,
  created_at timestamptz not null default now(),
  -- One cached answer per turn. Also makes the insert idempotent, so two tabs
  -- expanding the same turn cannot produce duplicate rows.
  unique (session_id, turn_index)
);

create index if not exists coach_answers_session_idx
  on coach_answers(session_id, turn_index);

-- ---------------------------------------------------------------------------
-- RLS. Ownership is derived through the parent session, exactly as
-- `turn_analyses_owner_all` does in 0006 and `messages_owner_all` in 0001 —
-- the table has no `user_id` of its own, so there is no second copy of the
-- ownership fact to drift.
-- ---------------------------------------------------------------------------
alter table coach_answers enable row level security;

drop policy if exists "coach_answers_owner_all" on coach_answers;
create policy "coach_answers_owner_all" on coach_answers
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

grant select, insert, update, delete on table coach_answers to authenticated;
