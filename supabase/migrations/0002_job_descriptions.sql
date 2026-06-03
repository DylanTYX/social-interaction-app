-- Phase 3: job-description-aware interviews and pgvector retrieval.
--
-- Apply after 0001_init.sql.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- job_descriptions
-- ---------------------------------------------------------------------------
create table if not exists job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  role_title text,
  source_type text not null default 'text' check (source_type in ('text')),
  raw_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_descriptions_user_idx
  on job_descriptions(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- job_description_chunks
-- ---------------------------------------------------------------------------
create table if not exists job_description_chunks (
  id uuid primary key default gen_random_uuid(),
  job_description_id uuid not null references job_descriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_estimate int not null default 0,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique(job_description_id, chunk_index)
);

create index if not exists job_description_chunks_job_idx
  on job_description_chunks(job_description_id, chunk_index);

-- Use ivfflat for approximate vector search once there is enough data. The
-- small list count is intentional for a student-scale app and can be raised
-- later when the table grows.
create index if not exists job_description_chunks_embedding_idx
  on job_description_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 20);

-- Attach a single JD to a session. Keeping the FK nullable makes normal
-- practice sessions unchanged.
alter table interview_sessions
  add column if not exists job_description_id uuid
  references job_descriptions(id) on delete set null;

create index if not exists sessions_job_description_idx
  on interview_sessions(job_description_id);

-- updated_at trigger for job_descriptions.
drop trigger if exists job_descriptions_set_updated_at on job_descriptions;
create trigger job_descriptions_set_updated_at
  before update on job_descriptions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Retrieval RPC
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table job_descriptions enable row level security;
alter table job_description_chunks enable row level security;

drop policy if exists "job_descriptions_owner_all" on job_descriptions;
create policy "job_descriptions_owner_all" on job_descriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "job_description_chunks_owner_all" on job_description_chunks;
create policy "job_description_chunks_owner_all" on job_description_chunks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
