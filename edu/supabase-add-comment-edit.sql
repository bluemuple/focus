-- =============================================================
-- One-time migration: add `edited_at` to wc_animal_comments
--
-- Powers the in-place edit feature on
-- focus/animals/animal-detail.html — when a user saves an edit,
-- the row's `text` is replaced AND `edited_at` is stamped, which
-- the renderer reads to show an "(edited)" tag next to the
-- timestamp. Nullable: a comment that has never been edited keeps
-- `edited_at = NULL`.
--
-- Safe to re-run.
-- =============================================================

alter table wc_animal_comments
  add column if not exists edited_at timestamptz;

comment on column wc_animal_comments.edited_at is
  'NULL if the comment has not been edited since it was posted. Stamped each time the author (or a teacher moderator) saves an edit.';
