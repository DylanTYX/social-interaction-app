-- Token accounting for every OpenAI call the app makes.
--
-- Apply after 0006_turn_analyses.sql.
--
-- The OpenAI response already carries `usage` on every call and all six call
-- sites discarded it. Without it there is no way to answer "what does a turn
-- cost", to see whether prompt caching is actually hitting, or to show a
-- measured before/after for any optimisation — only estimates.
--
-- Rows are written once per request (batched across that request's 3-4 calls),
-- best-effort: a failure here must never break an interview turn.

create table if not exists llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Null for calls not tied to a session (document embedding at upload time).
  session_id uuid references interview_sessions(id) on delete set null,
  -- Which logical call this was: 'interviewer', 'analyzer', 'summary',
  -- 'embedding', 'coach'. Lets you cost a turn by component.
  call_site text not null,
  model text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  -- Subset of prompt_tokens served from OpenAI's prompt cache at a discount.
  -- This is how you verify the stable/volatile prompt split is doing its job.
  cached_tokens int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists llm_usage_user_idx on llm_usage(user_id, created_at desc);
create index if not exists llm_usage_session_idx on llm_usage(session_id, created_at);

alter table llm_usage enable row level security;

drop policy if exists "llm_usage_owner_all" on llm_usage;
create policy "llm_usage_owner_all" on llm_usage
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert on table llm_usage to authenticated;

-- ---------------------------------------------------------------------------
-- Reporting helper
-- ---------------------------------------------------------------------------
--
-- Per-turn averages by call site for the signed-in user, optionally since a
-- cutoff. Run it before and after an optimisation to get the delta:
--
--   select * from llm_usage_summary(null);
--   select * from llm_usage_summary('2026-07-27'::timestamptz);
--
create or replace function llm_usage_summary(p_since timestamptz default null)
returns table (
  call_site text,
  model text,
  calls bigint,
  avg_prompt_tokens numeric,
  avg_completion_tokens numeric,
  avg_cached_tokens numeric,
  total_prompt_tokens bigint,
  total_completion_tokens bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    u.call_site,
    u.model,
    count(*) as calls,
    round(avg(u.prompt_tokens), 1) as avg_prompt_tokens,
    round(avg(u.completion_tokens), 1) as avg_completion_tokens,
    round(avg(u.cached_tokens), 1) as avg_cached_tokens,
    sum(u.prompt_tokens) as total_prompt_tokens,
    sum(u.completion_tokens) as total_completion_tokens
  from llm_usage u
  where u.user_id = auth.uid()
    and (p_since is null or u.created_at >= p_since)
  group by u.call_site, u.model
  order by sum(u.prompt_tokens) desc;
$$;

grant execute on function llm_usage_summary(timestamptz) to authenticated;
