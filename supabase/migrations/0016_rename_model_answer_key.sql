-- Rename the `modelAnswer` key in cached coach payloads to `suggestedAnswer`.
--
-- Apply after 0015_document_metadata.sql.
--
-- "Model answer" was the name everywhere — the route path, the wire contract,
-- the JSON key the coach is asked to emit, and the label on screen. The label
-- is now "Suggested answer", which is both plainer English and honest about
-- what the field is: an *invented* strong answer, not a marking scheme. The
-- rename went through the whole stack rather than stopping at the UI, so
-- `/api/coach/suggested-answer` returns `{suggestedAnswer, rewrite, tips}` and
-- `SuggestedAnswerResult` is the one name for that shape.
--
-- `coach_answers.answer` stores that response verbatim (see 0010), so rows
-- written before this migration hold the old key. Left alone they would decode
-- to `suggestedAnswer: undefined` and every cached report turn would render
-- coaching with the suggested-answer panel silently missing — the one failure
-- mode that looks like the feature is broken rather than like a stale cache.
--
-- Rewritten rather than deleted: the rows are paid-for LLM output, and the
-- content did not change, only the name of the box it sits in.

update coach_answers
set answer = (answer - 'modelAnswer')
             || jsonb_build_object('suggestedAnswer', answer -> 'modelAnswer')
where answer ? 'modelAnswer';

-- The table comment in 0010 documents the old shape. It is left as written —
-- migrations are a record of what was done, not a description of the current
-- schema. `docs/DATA-MODEL.md` carries the current shape.
comment on column coach_answers.answer is
  '{ suggestedAnswer, rewrite, tips[] } — the response of POST /api/coach/suggested-answer, verbatim. Renamed from modelAnswer in 0016.';
