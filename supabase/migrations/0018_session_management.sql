-- 0018: letting people organise their sessions
--
-- A session could be opened and deleted, and nothing else. Its title is
-- generated from the interview brief or the round name, so it was often long
-- and meaningless, and a growing history had no way to be grouped, marked or
-- put aside. This adds, on interview_sessions:
--
--   title        a display name the candidate chooses. Deliberately not a
--                rename of scenario_title: /api/chat reads scenario_title into
--                the interviewer's prompt, so editing it would change what a
--                resumed interviewer is told the interview is about.
--   tags         free labels, filterable
--   pinned       kept at the top of the sessions list
--   notes        private notes on the report
--   archived_at  hidden from the default list without losing any scores
--   folder_id    one folder per session, from the new session_folders table
--
-- Every one of them is written only through update_session_progress, like
-- every other session field since 0012. That function now also checks that a
-- folder being assigned belongs to the caller: a foreign key alone would let a
-- session point at somebody else's folder id.

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

alter table session_folders enable row level security;

drop policy if exists "session_folders_owner_all" on session_folders;
create policy "session_folders_owner_all" on session_folders
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on table session_folders to authenticated;

drop trigger if exists session_folders_set_updated_at on session_folders;
create trigger session_folders_set_updated_at
  before update on session_folders
  for each row execute function set_updated_at();

-- Constant defaults, so adding these rewrites no rows and re-checks nothing.
alter table interview_sessions
  add column if not exists title text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists pinned boolean not null default false,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz,
  add column if not exists folder_id uuid
    references session_folders(id) on delete set null;

-- NOT VALID for the same reason as 0011: new writes are checked, existing rows
-- are not re-scanned. The defaults above satisfy all three regardless.
alter table interview_sessions
  drop constraint if exists interview_sessions_title_length;
alter table interview_sessions
  add constraint interview_sessions_title_length
  check (title is null or char_length(title) between 1 and 120)
  not valid;

alter table interview_sessions
  drop constraint if exists interview_sessions_notes_length;
alter table interview_sessions
  add constraint interview_sessions_notes_length
  check (notes is null or char_length(notes) <= 4000)
  not valid;

alter table interview_sessions
  drop constraint if exists interview_sessions_tag_count;
alter table interview_sessions
  add constraint interview_sessions_tag_count
  check (cardinality(tags) <= 12)
  not valid;

create index if not exists sessions_tags_idx
  on interview_sessions using gin (tags);
create index if not exists sessions_user_folder_idx
  on interview_sessions (user_id, folder_id);
create index if not exists sessions_user_pinned_idx
  on interview_sessions (user_id, pinned, created_at desc);

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
  -- A folder id from the caller is an id, not a permission. Checked here
  -- because this function bypasses RLS, and the foreign key would accept any
  -- existing folder, including another user's.
  if p_patch ? 'folder_id' and p_patch ->> 'folder_id' is not null then
    if not exists (
      select 1 from session_folders f
      where f.id = (p_patch ->> 'folder_id')::uuid and f.user_id = auth.uid()
    ) then
      raise exception 'Folder % not found or not accessible', p_patch ->> 'folder_id'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

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
      else archived_at end,
    folder_id = case
      when p_patch ? 'folder_id' then (p_patch ->> 'folder_id')::uuid
      else folder_id end
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
