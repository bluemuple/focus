-- =============================================================
-- One-time migration: wc_animal_wiki
--
-- Server-side cache for the GPT-rewritten Wikipedia summary that
-- animal-detail.html's wiki panel displays. animal_id is PK so
-- the wc-animal-wiki-gpt edge function can upsert in one call,
-- and the client can read the latest cached row by animal id.
--
-- Safe to re-run. Phase 1 trust model — open read+write, same as
-- the other wc_* tables.
-- =============================================================

create table if not exists wc_animal_wiki (
  animal_id     text        primary key,
  content       text        not null,
  source_title  text,
  generated_at  timestamptz not null default now()
);

alter table wc_animal_wiki enable row level security;

drop policy if exists "wc_animal_wiki_read"  on wc_animal_wiki;
drop policy if exists "wc_animal_wiki_write" on wc_animal_wiki;

create policy "wc_animal_wiki_read"
  on wc_animal_wiki for select using (true);

create policy "wc_animal_wiki_write"
  on wc_animal_wiki for all using (true) with check (true);

comment on table wc_animal_wiki is
  'Per-animal GPT-rewritten Wikipedia summary tuned for NZ Year-4 readers. Populated lazily on first wiki-panel open, or eagerly via admin.html → Prewarm Wiki.';
