-- Grant table and RPC privileges required by authenticated app users.
--
-- RLS policies still enforce per-user access. These grants only allow the
-- authenticated role to attempt reads/writes against the protected tables.

grant usage on schema public to authenticated;

grant select, insert, update, delete on table personas to authenticated;
grant select, insert, update, delete on table interview_sessions to authenticated;
grant select, insert, update, delete on table interview_messages to authenticated;
grant select, insert, update, delete on table job_descriptions to authenticated;
grant select, insert, update, delete on table job_description_chunks to authenticated;

grant execute on function match_job_description_chunks(vector, int, uuid)
  to authenticated;
