-- =============================================================
-- One-time migration: wc_korbar_cache
--
-- Cloud cache for the `wc-korbar-gpt` edge function — the Korean
-- sidebar ("Kor Bar") content: per-word easy English + Korean
-- meaning + word family, and per-sentence Korean chunk breakdown.
-- Keyed by kind + word + sentence-sense, so the first student to
-- tap a word pays the GPT call and every classmate reads instantly.
--
-- Mirrors wc_word_info_cache. Safe to re-run.
-- =============================================================

create table if not exists wc_korbar_cache (
  cache_key  text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

comment on table wc_korbar_cache is
  'Korean-sidebar (Kor Bar) content cache for the wc-korbar-gpt edge function.';

alter table wc_korbar_cache enable row level security;
drop policy if exists wc_korbar_cache_dev on wc_korbar_cache;
create policy wc_korbar_cache_dev on wc_korbar_cache
  for all using (true) with check (true);
