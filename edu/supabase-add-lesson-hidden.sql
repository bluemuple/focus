-- =============================================================
-- One-time migration: wc_lessons.hidden
--
-- Adds a per-lesson visibility flag. The teacher toggles it from
-- the Lessons tab; students never see lessons whose hidden = true.
-- Safe to re-run.
-- =============================================================

alter table wc_lessons
  add column if not exists hidden boolean not null default false;

comment on column wc_lessons.hidden is
  'When true, the lesson is invisible to students. Teachers still see it (faded) in their dashboard. Toggled from teacher.html → Lessons tab.';
