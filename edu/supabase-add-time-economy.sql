-- =============================================================
-- One-time migration: wc_time_entries
--
-- The "time economy": a student earns screen-time minutes from the
-- reward wheel that spins after catching an animal, and spends them
-- (logged with an optional memo) from the ⏰ popup on the home page.
--
-- One ledger row per event:
--   kind = 'earn'  — wheel reward (memo: what it was for)
--   kind = 'spend' — the student logged using N minutes (memo: how)
-- Balance = sum(earn.minutes) - sum(spend.minutes), computed by the
-- client. The weekly bar graph groups 'earn' rows by day.
--
-- Safe to re-run.
-- =============================================================

create table if not exists wc_time_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references wc_users(id) on delete cascade,
  kind       text not null check (kind in ('earn','spend')),
  minutes    integer not null default 0,
  memo       text,
  created_at timestamptz not null default now()
);

comment on table wc_time_entries is
  'Screen-time ledger. earn rows = reward-wheel minutes; spend rows = minutes the student logged using. Balance = sum(earn) - sum(spend).';

create index if not exists wc_time_entries_user_idx
  on wc_time_entries(user_id, created_at desc);

alter table wc_time_entries enable row level security;
drop policy if exists wc_time_entries_dev on wc_time_entries;
create policy wc_time_entries_dev on wc_time_entries
  for all using (true) with check (true);
