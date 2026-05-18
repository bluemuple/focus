-- =============================================================
-- One-time migration: Subtraction Mental Methods 2 state columns
--
-- Adds two JSONB columns to wc_users to track the new module:
--   • smm2_practice_state — { level, cumulative, scores, lastCoinDate }
--     Read/written by focus/edu/js/practice2.js. Same shape as the
--     SMM1 `practice_state` column. ≥ 80 cumulative unlocks SMM2 race.
--   • smm2_race_state     — { level, runs[], best{}, total, lastGain,
--                             lastScore, lastCoinDate }
--     Read/written by focus/edu/js/race2.js. Same shape as the SMM1
--     `race_state` column. Drives the SMM2 class leaderboard.
--
-- Keeping these separate from `practice_state` / `race_state` so
-- SMM1 progress and leaderboards aren't mixed with SMM2's.
--
-- Safe to re-run.
-- =============================================================

alter table wc_users
  add column if not exists smm2_practice_state jsonb default '{}'::jsonb,
  add column if not exists smm2_race_state     jsonb default '{}'::jsonb;

comment on column wc_users.smm2_practice_state is
  'Subtraction Mental Methods 2 — adaptive practice state. { level, cumulative, scores }.';
comment on column wc_users.smm2_race_state is
  'Subtraction Mental Methods 2 — race history + best scores. { runs[], best{}, lastGain, lastScore, lastCoinDate }.';
