-- ============================================================
--  Back-to-Basic diagnosis test — per-student progress storage
--
--  Adds a `basic_stage` JSONB column to wc_users that records
--  what stage the student is on plus their per-stage score:
--    {
--      "currentStage": 3,
--      "results": {
--        "1": {"correct": 5, "total": 5},
--        "2": {"correct": 5, "total": 5},
--        "3": {"correct": 2, "total": 5}
--      },
--      "completed": false
--    }
--
--  Safe to run repeatedly.
-- ============================================================
alter table wc_users
  add column if not exists basic_stage jsonb default '{}'::jsonb;
