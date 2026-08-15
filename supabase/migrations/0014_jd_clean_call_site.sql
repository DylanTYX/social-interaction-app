-- ---------------------------------------------------------------------------
-- A call site for job-description cleaning
-- ---------------------------------------------------------------------------
--
-- `llm_usage.call_site` is constrained to a known vocabulary (0011), so a new
-- kind of model call needs a new value or its usage row is rejected outright.
--
-- Filing this under an existing site would have been the cheap option and the
-- wrong one. `coach` is a per-answer cost on the report and drills pages;
-- cleaning is a one-off at document upload with a completely different shape
-- and frequency. Mixing them makes `npm run cost-report` describe a spend
-- pattern that does not exist, and the whole point of the table is knowing
-- where the money goes.
--
-- Follows 0011's own convention of `not valid`: existing rows cannot contain
-- the new value, so there is nothing to re-check, and a migration that scans a
-- growing usage table to prove that helps nobody.

alter table llm_usage
  drop constraint if exists llm_usage_call_site_known;
alter table llm_usage
  add constraint llm_usage_call_site_known
  check (
    call_site in (
      'interviewer',
      'analyzer',
      'summary',
      'embedding',
      'coach',
      'resume-profile',
      'jd-clean'
    )
  )
  not valid;
