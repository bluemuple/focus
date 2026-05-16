-- =============================================================
-- One-time migration: wc_animal_wiki.secondary_image_url
--
-- Adds a per-animal column that stores the URL of the SECOND
-- Google Image search result for the animal's name. Used by
-- focus/animals/animal-detail.html's wiki panel to render a
-- distinct top-of-panel photo that's different from the
-- Wikipedia lead photo already shown in the gallery.
--
-- The wc-animal-image-2nd edge function fills this column lazily
-- (and on Prewarm); the client reads it directly without paying
-- for the Google CSE call on every page load.
--
-- Safe to re-run.
-- =============================================================

alter table wc_animal_wiki
  add column if not exists secondary_image_url text;

comment on column wc_animal_wiki.secondary_image_url is
  'Second Google Image search result for the animal. Populated by wc-animal-image-2nd edge function.';
