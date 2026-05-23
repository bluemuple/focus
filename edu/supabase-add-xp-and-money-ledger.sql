-- =============================================================
-- One-time migration: XP system + money ledger
--
-- A. wc_users.xp — the experience-point odometer that drives the new
--    28-level catcher progression (levels.js → WCLevels.levelForXp).
--    Replaces the old ceiling +1/−1 mechanism: marking a word, getting
--    a quiz answer right, catching an animal all add XP — failing
--    never subtracts. Levels go up only, with a steepening curve so
--    early wins come fast and Lv 28 is a real long-term goal.
--
-- B. wc_money_entries — earn/spend ledger for the dollar money system.
--    Mirrors wc_time_entries (earn rows from the reward wheel + catch
--    payouts; spend rows from the home ⏰-style money popup). The
--    weekly-earned graph + spend log read this; wc_users.money keeps
--    the authoritative balance (so legacy reads stay fast).
--
-- Amounts are integer cents — display as $X.XX in the client.
--
-- Safe to re-run.
-- =============================================================

-- A. XP odometer ---------------------------------------------------
alter table wc_users
  add column if not exists xp int not null default 0;

comment on column wc_users.xp is
  'Cumulative experience points. WCLevels.levelForXp(xp) maps it to a 1-28 catcher level. Bumped by word marks, quiz correct answers, and animal catches; never decreased.';

-- B. Money ledger --------------------------------------------------
create table if not exists wc_money_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references wc_users(id) on delete cascade,
  kind       text not null check (kind in ('earn','spend')),
  cents      integer not null default 0,
  memo       text,
  created_at timestamptz not null default now()
);

comment on table wc_money_entries is
  'Dollar money ledger. earn rows = reward-wheel money slices + animal-catch payouts; spend rows = amounts the student logged using. Balance is mirrored on wc_users.money (in cents).';

create index if not exists wc_money_entries_user_idx
  on wc_money_entries(user_id, created_at desc);

alter table wc_money_entries enable row level security;
drop policy if exists wc_money_entries_dev on wc_money_entries;
create policy wc_money_entries_dev on wc_money_entries
  for all using (true) with check (true);
