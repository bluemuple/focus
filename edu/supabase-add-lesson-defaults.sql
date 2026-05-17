-- ============================================================
--  Per-lesson default toggles (Phase: teacher-controlled-defaults).
--
--  Two new columns on wc_lessons let the teacher decide what state
--  each lesson's sidebar chips START in for the student:
--
--    default_play_chunk  true  → 🔊 "Play chunk" ON  (default)
--                        false → 🔇 "Mute chunk" ON
--
--    default_animals     true  → 🐾 "Animals on"     ON
--                        false → 🚫 "Animals off"   ON   (default)
--
--  These set the INITIAL state when the student opens the lesson.
--  Within the lesson the student can still toggle, but the toggle
--  is ephemeral — re-opening the lesson resets to the teacher's
--  default. Lessons created before this migration get the
--  out-of-the-box defaults (Play chunk on, Animals off).
--
--  Safe to run repeatedly — `add column if not exists`.
-- ============================================================
alter table wc_lessons
  add column if not exists default_play_chunk boolean default true,
  add column if not exists default_animals    boolean default false;

-- Backfill any pre-existing rows whose new column ended up NULL
-- (some old PostgREST inserts include a literal NULL even when the
-- column has a default). Idempotent — UPDATE with WHERE-NULL.
update wc_lessons set default_play_chunk = true  where default_play_chunk is null;
update wc_lessons set default_animals    = false where default_animals    is null;
