-- =============================================================
-- One-time migration: wc_lessons.mode
--
-- A lesson is now one of three TYPES, picked by the mode tabs on
-- the teacher upload form:
--   text  — plain reading (the original behaviour)
--   comic — panel images + speech-bubble overlays
--   song  — pop-song lyrics + an mp3
--
-- The lesson page renders the text-output area differently per
-- mode (toolbar / sidebar stay the same). Older lessons without
-- the column read back as 'text' thanks to the default.
--
-- Safe to re-run.
-- =============================================================

alter table wc_lessons
  add column if not exists mode text not null default 'text';

comment on column wc_lessons.mode is
  'Lesson type: text | comic | song. Set by the mode tabs on teacher.html; the lesson page renders the body area per mode.';
