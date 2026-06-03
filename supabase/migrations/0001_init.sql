-- Initial Supabase schema for ConvoTrainer.
--
-- Apply via the Supabase SQL editor (Dashboard → SQL → New query) or via the
-- Supabase CLI:
--   supabase db push
--
-- Phase 1 only — pgvector tables are added in a later migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- personas
-- ---------------------------------------------------------------------------
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('preset', 'user')),
  name text not null,
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personas_user_idx on personas(user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- interview_sessions
-- ---------------------------------------------------------------------------
create table if not exists interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_mode text not null check (practice_mode in ('text', 'voice')),
  scenario_value text not null,
  scenario_title text,
  scenario_description text,
  persona_id uuid references personas(id) on delete set null,
  persona_name text not null,
  persona_config jsonb not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  -- Rolling summary maintained server-side. Sent to the LLM each turn instead
  -- of the full transcript so token usage stays bounded.
  summary text,
  turn_count int not null default 0,
  -- Aggregate metrics computed at end of session.
  metrics jsonb,
  average_score int,
  duration_minutes int,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx
  on interview_sessions(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- interview_messages
-- ---------------------------------------------------------------------------
create table if not exists interview_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  turn_index int not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_session_idx
  on interview_messages(session_id, turn_index);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists personas_set_updated_at on personas;
create trigger personas_set_updated_at
  before update on personas
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table personas enable row level security;
alter table interview_sessions enable row level security;
alter table interview_messages enable row level security;

drop policy if exists "personas_owner_all" on personas;
create policy "personas_owner_all" on personas
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "sessions_owner_all" on interview_sessions;
create policy "sessions_owner_all" on interview_sessions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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
