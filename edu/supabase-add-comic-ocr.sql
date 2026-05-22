-- =============================================================
-- One-time migration: wc_ocr_cache
--
-- Cloud cache for the `wc-ocr` edge function (comic speech-bubble
-- text recognition). Keyed by a SHA-256 of the cropped bubble
-- image bytes — the first teacher to auto-detect a given bubble
-- pays Google Vision's cents, everyone re-opening the lesson (or
-- re-detecting the same crop) gets the text back free.
--
-- Mirrors wc_tts_cache. Safe to re-run.
-- =============================================================

create table if not exists wc_ocr_cache (
  cache_key  text primary key,
  text       text not null default '',
  created_at timestamptz not null default now()
);

comment on table wc_ocr_cache is
  'OCR result cache for the wc-ocr edge function. cache_key = SHA-256 of the cropped bubble image; text = recognised dialogue.';

alter table wc_ocr_cache enable row level security;
drop policy if exists wc_ocr_cache_dev on wc_ocr_cache;
create policy wc_ocr_cache_dev on wc_ocr_cache
  for all using (true) with check (true);
