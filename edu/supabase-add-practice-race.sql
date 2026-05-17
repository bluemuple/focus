-- ============================================================
--  Subtraction Mental Methods 1 — Practice + Race state.
--
--  Both stored as JSONB on wc_users.
--
--  practice_state shape:
--    {
--      "level": 3,                     -- current adaptive level (1-6)
--      "scores": { "3": {correct, total}, ... },  -- latest score per level
--      "cumulative": 60                -- sum of (correct * 10) over all sessions
--    }
--
--  race_state shape:
--    {
--      "level": 1,
--      "runs": [{level, speed, correct, avgTime, score, ts}, ...],
--      "best": { "1": 95, ... },       -- best score per level
--      "total": 280                    -- sum of all run scores
--    }
--
--  Safe to run repeatedly.
-- ============================================================
alter table wc_users
  add column if not exists practice_state jsonb default '{}'::jsonb,
  add column if not exists race_state    jsonb default '{}'::jsonb;
