-- =============================================================
-- One-time migration: add `extra_youtube_ids` to wc_animal_custom
--
-- Powers the "+ Add a video" button on
-- focus/animals/animal-detail.html. Each animal can now have
-- MULTIPLE YouTube videos stacked under the curated one — the
-- primary (curated) id lives in `youtube_id`, the extra ones in
-- this array. Stored as bare 11-char video IDs, in display order
-- (top → bottom under the primary).
--
-- Safe to re-run.
-- =============================================================

alter table wc_animal_custom
  add column if not exists extra_youtube_ids jsonb not null default '[]'::jsonb;

comment on column wc_animal_custom.extra_youtube_ids is
  'Bare 11-char YouTube IDs appended below the primary youtube_id on animal-detail.html. Order = display order.';
