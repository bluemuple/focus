-- =============================================================
-- One-time migration: wc_animal_custom
--
-- Per-animal customisation that BOTH the teacher admin and the
-- student inline editor write to. animal_id is the PK so updates
-- are idempotent UPSERTs. Detail page reads merge this on top of
-- the static ANIMALS base data in animals-data.js.
--
-- Each field is nullable — admins / students fill in only what
-- they want to override; everything else falls back to the base.
-- Phase 1 trust model — open read+write, narrowed later via JWT.
-- =============================================================

create table if not exists wc_animal_custom (
  animal_id            text         primary key,
  habitat              text,
  diet                 text,
  fun_facts            jsonb        not null default '[]'::jsonb,
  custom_topics        jsonb        not null default '[]'::jsonb,
  -- Each picture array is [{ src, source }] just like the existing
  -- animals-data.js shape, so the renderer needs no new code path.
  photos               jsonb        not null default '[]'::jsonb,
  cartoons             jsonb        not null default '[]'::jsonb,
  coloring_pages       jsonb        not null default '[]'::jsonb,
  youtube_id           text,
  approved_youtube_id  text,
  updated_at           timestamptz  not null default now(),
  -- audit columns — handy for "who last edited this animal" later.
  updated_by_id        uuid,
  updated_by_name      text
);

alter table wc_animal_custom enable row level security;

drop policy if exists "wc_animal_custom_read"  on wc_animal_custom;
drop policy if exists "wc_animal_custom_write" on wc_animal_custom;

create policy "wc_animal_custom_read"
  on wc_animal_custom for select using (true);

create policy "wc_animal_custom_write"
  on wc_animal_custom for all using (true) with check (true);

comment on table wc_animal_custom is
  'Cloud copy of per-animal customisation. Read by every animal-detail.html load; written by the teacher admin (admin.html) and the student inline editor on the animal-detail page when the user has hearted the animal.';
