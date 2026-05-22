-- =============================================================
-- One-time migration: wc_recordings
--
-- Persists the voice recordings a student makes in Record mode so
-- they survive a page reload / next visit. The audio blobs live in
-- the wc-lesson-images Storage bucket (under recordings/); this
-- table holds one row per take with its public URL.
--
--   sentence_key — normalised sentence text (lowercased, collapsed)
--   take_n       — 1..N take number for that line
--   selected     — the take chosen for full-lesson playback
--
-- Safe to re-run.
-- =============================================================

create table if not exists wc_recordings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references wc_users(id)   on delete cascade,
  lesson_id    uuid not null references wc_lessons(id) on delete cascade,
  sentence_key text not null,
  take_n       integer not null default 1,
  url          text not null,
  selected     boolean not null default false,
  created_at   timestamptz not null default now()
);

comment on table wc_recordings is
  'Per-take voice recordings (Record mode). Audio in Storage; one row per take with its public URL. Balance of state: selected = the take used in full-lesson playback.';

create index if not exists wc_recordings_user_lesson_idx
  on wc_recordings(user_id, lesson_id);

alter table wc_recordings enable row level security;
drop policy if exists wc_recordings_dev on wc_recordings;
create policy wc_recordings_dev on wc_recordings
  for all using (true) with check (true);
