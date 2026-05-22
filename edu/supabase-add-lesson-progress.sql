-- =============================================================
-- One-time migration: wc_lesson_progress
--
-- Stores how far each student has read in each lesson — the page
-- index of the page they last viewed. The lesson page restores
-- this on load so a long lesson (e.g. a multi-page comic) reopens
-- where the student left off. Word mastery already persists via
-- wc_word_states; this adds the missing "reading position".
--
-- One row per (user, lesson). Page is 0-based. Safe to re-run.
-- =============================================================

create table if not exists wc_lesson_progress (
  user_id    uuid not null references wc_users(id)   on delete cascade,
  lesson_id  uuid not null references wc_lessons(id) on delete cascade,
  -- 0-based index of the last page the student viewed.
  page       integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

comment on table wc_lesson_progress is
  'Per-student reading position (last page index) per lesson. Written by lesson.js on page change, read on lesson load to resume.';

-- Phase-1 permissive RLS (matches every other wc_* table — Phase 7
-- will tighten once login codes issue real JWTs).
alter table wc_lesson_progress enable row level security;
drop policy if exists wc_lesson_progress_dev on wc_lesson_progress;
create policy wc_lesson_progress_dev on wc_lesson_progress
  for all using (true) with check (true);
