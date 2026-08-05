-- Compact resume profile, distilled once at upload.
--
-- Apply after 0007_llm_usage.sql.
--
-- The interviewer prompt carried up to 6,000 characters of raw resume text on
-- every turn (~1,500 tokens). That text never changes during a session, so
-- re-sending it each turn bought nothing. We now summarise once at upload into
-- a dense, interview-relevant profile and send that instead.
--
-- Nullable on purpose: resumes uploaded before this column existed, and any
-- upload where summarisation failed, fall back to the raw text.

alter table resumes
  add column if not exists profile text;
