-- Promote the server-owned parts of `interview_sessions.metrics` to real columns.
--
-- Apply after 0008_resume_profile.sql.
--
-- `metrics` was one JSONB blob with four owners: `launch` (setup snapshot),
-- `loop` (multi-round progress), `competencyCoverage` (server-written after each
-- question), and the client's rolling score metrics. Three separate defences
-- existed purely to stop them destroying each other:
--
--   * a SERVER_OWNED_METRIC_KEYS denylist stripping keys from client PATCHes,
--   * a read-then-write shallow merge in updateSession — which still races,
--     because /api/chat writes coverage while the client writes scores on the
--     same row every turn,
--   * a derive-don't-persist workaround for dimension snapshots in the client
--     hook, because the merge is shallow.
--
-- Columns give all of that for free, and let `/api/loops/[loopId]` query by
-- loop id instead of loading 200 sessions and filtering in memory.
--
-- Deliberately non-destructive: the old keys are left inside `metrics` for one
-- release so a rollback does not lose data. A later migration can drop them
-- once this is proven.

alter table interview_sessions
  add column if not exists launch_meta jsonb,
  add column if not exists loop_id uuid,
  add column if not exists loop_progress jsonb,
  add column if not exists competency_coverage jsonb;

-- ---------------------------------------------------------------------------
-- Backfill. Idempotent and re-runnable: only fills columns that are still null,
-- and only from keys that actually exist.
-- ---------------------------------------------------------------------------
update interview_sessions
set launch_meta = metrics -> 'launch'
where launch_meta is null
  and metrics ? 'launch';

update interview_sessions
set loop_progress = metrics -> 'loop'
where loop_progress is null
  and metrics ? 'loop';

update interview_sessions
set competency_coverage = metrics -> 'competencyCoverage'
where competency_coverage is null
  and metrics ? 'competencyCoverage';

-- `loopId` is a uuid stored as a JSON string. Guard the cast: a malformed value
-- should leave the row alone rather than abort the migration.
update interview_sessions
set loop_id = (metrics -> 'loop' ->> 'loopId')::uuid
where loop_id is null
  and metrics -> 'loop' ->> 'loopId' ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- The whole point of extracting loop_id: the loop report can now ask the
-- database for its rounds instead of scanning every session the user owns.
create index if not exists sessions_loop_idx
  on interview_sessions(loop_id, created_at)
  where loop_id is not null;
