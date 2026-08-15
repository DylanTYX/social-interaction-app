-- ---------------------------------------------------------------------------
-- Job description metadata
-- ---------------------------------------------------------------------------
--
-- The library was unmanageable past a handful of rows. A JD carried a title, a
-- role title and its text, and nothing to tell two "Product Manager" postings
-- apart. There was also no update path anywhere in the API, so a title was
-- permanent once written — which matters more than it sounds, because titles
-- are derived rather than entered: `buildJobDescriptionTitle` falls back to the
-- first line of the pasted text between 4 and 80 characters, and for a paste
-- from a careers page that is usually "About the role".
--
-- Three nullable columns, no backfill and no constraint marked `not valid`,
-- because nothing here is being tightened — these are new and empty. Existing
-- rows read as "no company recorded", which is accurate.
--
-- Deliberately NOT added: an application status (applied / interviewing /
-- rejected). That would make this a job-hunt tracker, which is a different
-- product from an interview simulator, and the two would diverge fast.
--
-- Also deliberately not added: an `archived_at` for soft deletes. Retrieval is
-- already scoped by `filter_job_description_id`, sessions reference JDs with
-- `on delete set null` rather than cascade, and the report reads its JD label
-- from the `launch_meta` snapshot — so hard delete loses nothing an archive
-- would have preserved, and archiving would only accumulate 1536-dimension
-- vectors nobody will read again.

alter table job_descriptions
  add column if not exists company text;

alter table job_descriptions
  add column if not exists source_url text;

alter table job_descriptions
  add column if not exists notes text;

-- Backs the library page's company filter. `user_id` leads because RLS scopes
-- every read to one user, so it is the selective half of every query here.
create index if not exists job_descriptions_user_company_idx
  on job_descriptions(user_id, company);
