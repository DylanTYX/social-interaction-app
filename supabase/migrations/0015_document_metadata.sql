-- ---------------------------------------------------------------------------
-- Document metadata: truncation, CV labels, and a missing trigger
-- ---------------------------------------------------------------------------
--
-- Three unrelated-looking additions that share one theme: making the state of a
-- stored document knowable after the moment it was created.
--
-- `truncated_from` records the original length when an upload exceeded the cap.
-- Both tables get it, because both truncate now — the job-description route
-- used to reject an over-length paste outright and the resume route used to
-- clip it silently, which are two different wrong answers to one question. The
-- user is told at upload either way, but a toast is gone in five seconds and
-- the fact that a third of the document is missing should outlive it.
--
-- Null means "stored whole", which is the overwhelming majority and the reason
-- this is nullable rather than defaulted to the current length.
--
-- `variant` and `notes` are for the CV library only, and are deliberately
-- library-only: neither reaches the interviewer's prompt. `variant` is the CV
-- analogue of a job description's role title — people keep a "PM version" and
-- an "IC/backend version" and cannot otherwise tell them apart, since the list
-- shows a title and a date and the title is guessed from the first line of the
-- file. There is no `company` equivalent, because a CV does not have one.

alter table resumes
  add column if not exists variant text;

alter table resumes
  add column if not exists notes text;

alter table resumes
  add column if not exists truncated_from integer;

alter table job_descriptions
  add column if not exists truncated_from integer;

-- ---------------------------------------------------------------------------
-- The trigger `resumes` never had
-- ---------------------------------------------------------------------------
--
-- `0002` created one for `job_descriptions` and `0004` did not create the
-- matching one for `resumes`, so `updated_at` has been frozen at insert time
-- for every CV ever saved. Nothing noticed while the table had no update path
-- — but `/dashboard/resumes` already sorts by `updatedAt` specifically "so
-- editing an entry moves it", which it could never do. Adding the PATCH route
-- without this would ship an edit that silently fails to reorder the list.

drop trigger if exists resumes_set_updated_at on resumes;
create trigger resumes_set_updated_at
  before update on resumes
  for each row execute function set_updated_at();
