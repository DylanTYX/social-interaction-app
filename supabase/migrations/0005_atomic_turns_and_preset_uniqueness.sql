-- Concurrency hardening for interview turns and preset persona seeding.
--
-- Apply after 0004_resumes.sql.
--
-- Two independent races are fixed here:
--
--   1. `appendTurn` read `turn_count`, derived `turn_index` from it, inserted
--      two message rows, then bumped the counter in a separate statement. Two
--      overlapping `/api/chat` calls on one session computed the same indices
--      and wrote duplicates; a failure between the insert and the bump left
--      the counter permanently out of step with the rows.
--
--   2. `listPersonas` seeded the built-in presets with a read-then-insert. Two
--      concurrent first loads (two tabs, or the library and the setup wizard)
--      both saw an empty table and both inserted, giving the new user every
--      preset twice.

-- ---------------------------------------------------------------------------
-- 1. Atomic turn append
-- ---------------------------------------------------------------------------

-- Backstop for the RPC below, and for any other writer. Existing sessions may
-- already contain duplicates from the old code path, so de-duplicate first,
-- keeping the earliest row for each (session_id, turn_index).
delete from interview_messages m
using interview_messages keeper
where m.session_id = keeper.session_id
  and m.turn_index = keeper.turn_index
  and (keeper.created_at, keeper.id) < (m.created_at, m.id);

alter table interview_messages
  drop constraint if exists interview_messages_session_turn_key;
alter table interview_messages
  add constraint interview_messages_session_turn_key
  unique (session_id, turn_index);

/**
 * Append one interview turn and bump `turn_count` in a single transaction.
 *
 * `p_user_content` is null for the opening turn, where the interviewer speaks
 * first and only an assistant row is written.
 *
 * The `for update` on the session row is what actually serializes concurrent
 * turns: a second caller blocks until the first commits, then reads the
 * updated counter rather than the stale one. Returns the new `turn_count`.
 *
 * Invoker rights (the default) — RLS on both tables still applies, so a user
 * can only append to sessions they own, exactly as before.
 */
create or replace function append_interview_turn(
  p_session_id uuid,
  p_user_content text,
  p_assistant_content text
)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_turn int;
  next_turn int;
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
    next_turn := current_turn + 2;
    insert into interview_messages (session_id, role, content, turn_index)
    values
      (p_session_id, 'user', p_user_content, current_turn + 1),
      (p_session_id, 'assistant', p_assistant_content, next_turn);
  end if;

  update interview_sessions
  set turn_count = next_turn
  where id = p_session_id;

  return next_turn;
end;
$$;

grant execute on function append_interview_turn(uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Preset persona uniqueness
-- ---------------------------------------------------------------------------

-- Remove pre-existing duplicates before the index can be created, keeping the
-- oldest row of each (user_id, name) preset pair.
delete from personas p
using personas keeper
where p.kind = 'preset'
  and keeper.kind = 'preset'
  and p.user_id = keeper.user_id
  and p.name = keeper.name
  and (keeper.created_at, keeper.id) < (p.created_at, p.id);

create unique index if not exists personas_user_preset_name_idx
  on personas(user_id, name)
  where kind = 'preset';
