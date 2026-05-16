-- =============================================================
--   WordCatch — bootstrap (run AFTER supabase-schema.sql)
--
--   Creates the first teacher account so you can log in. WordCatch
--   has no "school admin" — teachers add themselves via direct DB
--   insert ONCE per teacher (we'll add a UI for this in Phase 7).
--
--   1. Edit the row below: real_name + login_code (4 digits).
--   2. Run this whole file in the Supabase SQL editor.
--   3. Open /focus/reading/index.html → "I'm a Teacher" → sign in.
-- =============================================================

insert into wc_users (role, real_name, login_code)
values
  -- ⬇⬇⬇ EDIT THESE TWO BEFORE RUNNING ⬇⬇⬇
  ('teacher', 'Ms Wilson', '2468')
  -- ⬆⬆⬆ EDIT THESE TWO BEFORE RUNNING ⬆⬆⬆
on conflict do nothing;
