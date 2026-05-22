-- =============================================================
-- One-time migration: wc_lessons.audio_url + .audio_segments
--
-- A lesson can attach an mp3 of the text read aloud. The teacher
-- marks which slice of audio each sentence is; the lesson page
-- then puts a 🔊 on that sentence so students can hear exactly
-- that part.
--
--   audio_url       — public Storage URL of the mp3
--   audio_segments  — [{ "text": "...", "start": 1.2, "end": 3.4 }]
--                     start / end are seconds into the mp3; matched
--                     to a rendered sentence by its (normalised) text
--
-- Safe to re-run.
-- =============================================================

alter table wc_lessons
  add column if not exists audio_url text;

alter table wc_lessons
  add column if not exists audio_segments jsonb not null default '[]'::jsonb;

comment on column wc_lessons.audio_url is
  'Public Storage URL of the lesson''s mp3 (text read aloud). Null = no audio.';
comment on column wc_lessons.audio_segments is
  'Per-sentence audio timings: [{text,start,end}] in seconds. Set in the teacher Audio-sync editor; the lesson page plays the slice when a sentence''s 🔊 is tapped.';
