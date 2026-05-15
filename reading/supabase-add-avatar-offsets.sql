-- =============================================================
-- One-time migration: wc_avatar_offsets
--
-- Stores the global per-category position offsets for The Space's
-- avatar wearables. The teacher's Fitting Room tab upserts the
-- single 'global' row whenever they click "Save & Apply"; every
-- student fetches it on page load and listens for live updates
-- through the Realtime channel.
--
-- Run this in Supabase SQL Editor once (it's idempotent — safe
-- to re-run).
-- =============================================================

create table if not exists wc_avatar_offsets (
  id          text primary key,
  offsets     jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table wc_avatar_offsets enable row level security;

drop policy if exists "wc_avatar_offsets_read"   on wc_avatar_offsets;
drop policy if exists "wc_avatar_offsets_insert" on wc_avatar_offsets;
drop policy if exists "wc_avatar_offsets_update" on wc_avatar_offsets;

-- Phase 1: open read+write — same trust model as the rest of the
-- WordCatch tables. Phase 7 will lock writes to authenticated
-- teachers via a JWT claim.
create policy "wc_avatar_offsets_read"
  on wc_avatar_offsets for select using (true);
create policy "wc_avatar_offsets_insert"
  on wc_avatar_offsets for insert with check (true);
create policy "wc_avatar_offsets_update"
  on wc_avatar_offsets for update using (true) with check (true);

-- Seed the single global row so the very first upsert is an
-- update (matches `on_conflict=id`).
insert into wc_avatar_offsets (id, offsets)
values ('global', '{}'::jsonb)
on conflict (id) do nothing;

-- Per-category dimensions (width = height for now; all wearables
-- are square). Stored next to offsets so the teacher Fitting Room
-- can push position + size in the same upsert.
alter table wc_avatar_offsets
  add column if not exists sizes jsonb not null default '{}'::jsonb;
