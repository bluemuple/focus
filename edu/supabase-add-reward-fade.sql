-- =============================================================
-- One-time migration: wc_users.total_pages_read
--
-- The "reward fade" (Self-Determination Theory internalization):
-- extrinsic rewards (animal quiz frequency, word-mark coins, the
-- screen-time wheel) thin out automatically as a student reads
-- more — dense early to build the habit, sparse later so intrinsic
-- motivation isn't crowded out.
--
-- This column is the fade's odometer: a running count of forward
-- pages the student has turned, across every lesson and session.
-- The lesson page bumps it on each page advance; the client maps
-- it to a 0.25–1.0 "reward intensity" via WCDB.rewardIntensity().
--
-- Class-level fade settings (rewardFade preset, dailyRestMinutes)
-- live in the existing wc_classes.hide_features JSONB — no column.
--
-- Safe to re-run.
-- =============================================================

alter table wc_users
  add column if not exists total_pages_read int not null default 0;

comment on column wc_users.total_pages_read is
  'Cumulative forward pages turned (all lessons). Drives the SDT reward-fade: WCDB.rewardIntensity() maps it to a 0.25–1.0 intensity that scales quiz frequency, coin frequency and the reward wheel.';
