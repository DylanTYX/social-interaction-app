-- Resumes / CVs the candidate can attach to a session so the interviewer can
-- ask targeted questions about their actual background and cross-check claims.
--
-- Unlike job descriptions (which are chunked + embedded for RAG retrieval),
-- resumes are short enough (1-2 pages) to fit in the prompt whole, so we only
-- store the extracted text. No embeddings table is needed.

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_type text not null default 'text' check (source_type in ('text')),
  raw_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resumes_user_idx
  on resumes(user_id, created_at desc);

-- Nullable attachment on a session, mirroring job_description_id.
alter table interview_sessions
  add column if not exists resume_id uuid
  references resumes(id) on delete set null;

create index if not exists sessions_resume_idx
  on interview_sessions(resume_id);

-- Row-level security: owner-only access.
alter table resumes enable row level security;

drop policy if exists "resumes_owner_all" on resumes;
create policy "resumes_owner_all" on resumes
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Privileges for the authenticated role (RLS still applies on top).
grant select, insert, update, delete on table resumes to authenticated;
