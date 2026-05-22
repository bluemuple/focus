-- =============================================================
-- One-time migration: wc_lessons.default_scroll
--
-- "Continuous scroll" reading mode. When ON the lesson page drops
-- pagination and flows the whole lesson in one scrollable column
-- (comic panels stacked vertically). The student can flip the
-- mode per-device with the ⬇ toolbar chip; this column is the
-- per-lesson DEFAULT the teacher picks on the upload form.
--
--   true   — lesson opens in scroll mode
--   false  — lesson opens paginated
--   NULL   — no teacher preference; the lesson page falls back to
--            ON for comic lessons, OFF for text / song lessons
--
-- Nullable on purpose so "teacher didn't choose" stays distinct
-- from "teacher chose off". Safe to re-run.
-- =============================================================

alter table wc_lessons
  add column if not exists default_scroll boolean;

comment on column wc_lessons.default_scroll is
  'Default for the continuous-scroll (⬇) reading mode. true=on, false=off, NULL=auto (comic→on, text/song→off). Set by the 만화 scroll checkbox on teacher.html.';
