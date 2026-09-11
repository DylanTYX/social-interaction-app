-- ConvoTrainer database, part 2 of 3: row-level security and table privileges.
--
-- Run after 0001_schema.sql.
--
-- Two layers, and they answer different questions. RLS decides *whose rows* a
-- statement may touch: every policy below is the owner rule, `user_id =
-- auth.uid()`, reached through the parent session for tables that have no
-- `user_id` of their own. Privileges decide *which statements* are allowed at
-- all, and RLS cannot express that — it says nothing about which columns or
-- values a permitted row may be given.
--
-- The browser holds the publishable key and a live session, so anything
-- granted to `authenticated` can be done from devtools through PostgREST, not
-- only through the API routes. Two things therefore cannot be granted:
--
--   * updating an interview session. Its scores, summary and `launch_meta`
--     are server-owned (`launch_meta.loopBrief` lands verbatim in a system
--     prompt). Every change goes through `update_session_progress` or
--     `append_interview_turn` in 0003_functions.sql, which re-check ownership.
--   * inserting usage rows. The cost report is measured from them, so they
--     come only from `record_llm_usage`.
--
-- On Supabase, default privileges already grant tables created in `public` to
-- `authenticated`. The grants below are stated so the intended access is
-- readable here; the two `revoke`s are the ones that change anything.

grant usage on schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Tables owned directly through user_id
-- ---------------------------------------------------------------------------
alter table personas enable row level security;
drop policy if exists "personas_owner_all" on personas;
create policy "personas_owner_all" on personas
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on table personas to authenticated;

alter table job_descriptions enable row level security;
drop policy if exists "job_descriptions_owner_all" on job_descriptions;
create policy "job_descriptions_owner_all" on job_descriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on table job_descriptions to authenticated;

alter table job_description_chunks enable row level security;
drop policy if exists "job_description_chunks_owner_all" on job_description_chunks;
create policy "job_description_chunks_owner_all" on job_description_chunks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on table job_description_chunks to authenticated;

alter table resumes enable row level security;
drop policy if exists "resumes_owner_all" on resumes;
create policy "resumes_owner_all" on resumes
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on table resumes to authenticated;

-- Created and deleted directly (creation goes through the API, which sanitises
-- `launch_meta`); never updated directly.
alter table interview_sessions enable row level security;
drop policy if exists "sessions_owner_all" on interview_sessions;
create policy "sessions_owner_all" on interview_sessions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, delete on table interview_sessions to authenticated;
revoke update on table interview_sessions from authenticated;

-- Readable by its owner, written only by record_llm_usage.
alter table llm_usage enable row level security;
drop policy if exists "llm_usage_owner_all" on llm_usage;
create policy "llm_usage_owner_all" on llm_usage
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select on table llm_usage to authenticated;
revoke insert on table llm_usage from authenticated;

-- ---------------------------------------------------------------------------
-- Tables owned through their parent session
--
-- No `user_id` column, so there is no second copy of the ownership fact to
-- drift out of step with the session's.
-- ---------------------------------------------------------------------------
alter table interview_messages enable row level security;
drop policy if exists "messages_owner_all" on interview_messages;
create policy "messages_owner_all" on interview_messages
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
grant select, insert, update, delete on table interview_messages to authenticated;

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
grant select, insert, update, delete on table interview_turn_analyses to authenticated;

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
