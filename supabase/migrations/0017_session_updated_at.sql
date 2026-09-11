-- 0017: interview_sessions.updated_at
--
-- 0012 rewrote append_interview_turn to finish with
--
--   update interview_sessions set turn_count = next_turn, updated_at = now()
--
-- but interview_sessions has never had an updated_at column — 0001 gave it
-- started_at, ended_at and created_at, and nothing since added one. plpgsql
-- resolves column names when a statement runs, not when the function is
-- created, so 0012 applied cleanly and every call afterwards failed with 42703
-- (undefined_column). The function is a single transaction, so nothing it
-- wrote survived: the interviewer's greeting was generated and then discarded,
-- every later turn failed the same way, and a resumed session had no messages
-- to show.
--
-- Adding the column is a smaller change than redefining the function, and the
-- timestamp is worth having. There is deliberately no backfill UPDATE: now()
-- is stable, so this default is recorded in the catalogue without rewriting or
-- re-checking existing rows, whereas an UPDATE would re-validate 0011's
-- NOT VALID constraints against rows that predate them. Existing sessions read
-- the time this migration ran.

alter table interview_sessions
  add column if not exists updated_at timestamptz not null default now();

-- Keep it true for every write to a session, not only the turns the function
-- records — the same trigger personas, job_descriptions and resumes already use.
drop trigger if exists interview_sessions_set_updated_at on interview_sessions;
create trigger interview_sessions_set_updated_at
  before update on interview_sessions
  for each row execute function set_updated_at();
