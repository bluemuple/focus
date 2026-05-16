-- =============================================================
-- One-time migration: wc_users.avatar
--
-- Stores each student/teacher's saved avatar (hair / hat / top /
-- bottom / shoes / glasses / beard / face IDs + per-category
-- colour hue). The Space writes it on "Finish Editing" and reads
-- it back on every page load, so the same person opening their
-- account on a different device sees the same avatar.
--
-- localStorage stays as a fast cache; this column is the source
-- of truth. Realtime presence still broadcasts changes
-- intra-session for instant updates between connected clients.
--
-- Run this in Supabase SQL Editor once. Safe to re-run.
-- =============================================================

alter table wc_users
  add column if not exists avatar jsonb;
