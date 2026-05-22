-- =============================================================
-- One-time migration: wc_align_cache
--
-- Cloud cache for the `wc-align` edge function (mp3 → per-sentence
-- timestamps via Google Speech-to-Text). Keyed by a SHA-256 of the
-- audio reference + the sentence list — re-opening the Audio-sync
-- editor for the same lesson returns the alignment instantly
-- instead of re-running a (slow, paid) speech-recognition job.
--
-- Mirrors wc_tts_cache / wc_ocr_cache. Safe to re-run.
-- =============================================================

create table if not exists wc_align_cache (
  cache_key  text primary key,
  segments   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table wc_align_cache is
  'Audio-alignment cache for the wc-align edge function. cache_key = SHA-256(audio ref + lines); segments = [{start,end}|null] per sentence.';

alter table wc_align_cache enable row level security;
drop policy if exists wc_align_cache_dev on wc_align_cache;
create policy wc_align_cache_dev on wc_align_cache
  for all using (true) with check (true);
