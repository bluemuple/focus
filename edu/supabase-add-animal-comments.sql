-- =============================================================
-- One-time migration: wc_animal_comments + wc_animal_contributions
--
-- Two tables to support the per-animal comment thread on
-- focus/animals/animal-detail.html:
--
--   • wc_animal_comments  — one row per posted message; replies
--     use parent_id for nesting (1 level deep in the UI).
--
--   • wc_animal_contributions — one row per (animal, contributor)
--     showing that this user has at least once ADDED content
--     (not just deleted) to that animal's page. The comment box
--     surfaces on animals that have any contributor row, and the
--     "Post" permission is granted to users who themselves have
--     at least one contribution row anywhere.
--
-- Phase 1 trust model — open read+write, same as other wc_*.
-- Safe to re-run.
-- =============================================================

create table if not exists wc_animal_comments (
  id           uuid        primary key default gen_random_uuid(),
  animal_id    text        not null,
  parent_id    uuid        references wc_animal_comments(id) on delete cascade,
  author_id    uuid        references wc_users(id) on delete set null,
  author_name  text        not null,
  text         text        not null,
  created_at   timestamptz not null default now()
);

create index if not exists wc_animal_comments_animal_idx
  on wc_animal_comments(animal_id, created_at);

alter table wc_animal_comments enable row level security;

drop policy if exists "wc_animal_comments_read"  on wc_animal_comments;
drop policy if exists "wc_animal_comments_write" on wc_animal_comments;

create policy "wc_animal_comments_read"
  on wc_animal_comments for select using (true);

create policy "wc_animal_comments_write"
  on wc_animal_comments for all using (true) with check (true);

comment on table wc_animal_comments is
  'Threaded discussion on each animal-detail page. parent_id chains a reply to its parent. Permission to post is enforced client-side via wc_animal_contributions.';


create table if not exists wc_animal_contributions (
  animal_id       text         not null,
  contributor_id  uuid         not null references wc_users(id) on delete cascade,
  contributor_name text,
  first_added_at  timestamptz  not null default now(),
  primary key (animal_id, contributor_id)
);

create index if not exists wc_animal_contributions_user_idx
  on wc_animal_contributions(contributor_id);

alter table wc_animal_contributions enable row level security;

drop policy if exists "wc_animal_contributions_read"  on wc_animal_contributions;
drop policy if exists "wc_animal_contributions_write" on wc_animal_contributions;

create policy "wc_animal_contributions_read"
  on wc_animal_contributions for select using (true);

create policy "wc_animal_contributions_write"
  on wc_animal_contributions for all using (true) with check (true);

comment on table wc_animal_contributions is
  'Idempotent record of users who have added (not deleted) content to a given animal. Drives whether the comment box appears AND whether the active user can post a comment anywhere.';
