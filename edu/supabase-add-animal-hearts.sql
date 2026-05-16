-- =============================================================
-- One-time migration: wc_animal_hearts
--
-- A single-row-per-user table holding which animal each user has
-- hearted. user_id is PK, so the heart auto-replaces on upsert
-- (one heart per user, ever). The Ako admin page in
-- focus/animals/ reads it to render heart counts, names of
-- supporters, and to gate the student-side animal edit feature.
-- Phase 1 trust model — open read+write, same as other wc_*
-- tables.
-- =============================================================

create table if not exists wc_animal_hearts (
  user_id     uuid        primary key references wc_users(id) on delete cascade,
  animal_id   text        not null,
  updated_at  timestamptz not null default now()
);

create index if not exists wc_animal_hearts_animal_idx
  on wc_animal_hearts(animal_id);

alter table wc_animal_hearts enable row level security;

drop policy if exists "wc_animal_hearts_read"   on wc_animal_hearts;
drop policy if exists "wc_animal_hearts_write"  on wc_animal_hearts;

create policy "wc_animal_hearts_read"
  on wc_animal_hearts for select using (true);

-- One open write policy covers insert + update + delete in Phase 1.
-- Phase 7 will narrow this down via a JWT-claim check.
create policy "wc_animal_hearts_write"
  on wc_animal_hearts for all using (true) with check (true);

comment on table wc_animal_hearts is
  'Single-heart-per-user vote on which animal they love. Drives heart counts on the animals list and the student-side edit-permission gate.';
