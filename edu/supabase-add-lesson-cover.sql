-- =============================================================
-- One-time migration: wc_lessons.cover_image_url
--
-- The teacher's lesson editor now has a "Cover image" picker
-- (next to Title). Students see the cover on the home library
-- view (home.html lessonList) — books on a shelf, with the title
-- + a "단어 클릭" progress gauge below each cover.
--
-- For text + comic lessons the cover is whatever the teacher
-- picked (book / poster). For song lessons it's the song's CD
-- cover. The lesson page itself does NOT use this column.
--
-- Safe to re-run.
-- =============================================================

alter table wc_lessons
  add column if not exists cover_image_url text;

comment on column wc_lessons.cover_image_url is
  'Public Storage URL of the lesson cover image (book / song CD cover). Shown on the student home library view next to the title + a per-student word-click progress gauge.';
