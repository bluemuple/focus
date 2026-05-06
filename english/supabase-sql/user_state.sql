-- =============================================================
--   user_state — small per-user JSON key/value store
--
--   Used by the English Learning app to sync cross-device prefs
--   (NZD piggy bank, streak, …) between PC and mobile. Each key
--   holds a single JSON blob; client reads the whole blob and
--   upserts the whole blob on every change. Last-writer-wins.
--
--   Run this whole script ONCE in Supabase → SQL editor.
-- =============================================================

create table if not exists user_state (
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  value       jsonb,
  updated_at  timestamptz default now(),
  primary key (user_id, key)
);

-- Speed up the common "fetch all keys for this user" query.
create index if not exists user_state_user_idx on user_state (user_id);

alter table user_state enable row level security;

-- Each policy is dropped-and-recreated so re-running this script is safe.
drop policy if exists "user_state read own"   on user_state;
drop policy if exists "user_state insert own" on user_state;
drop policy if exists "user_state update own" on user_state;
drop policy if exists "user_state delete own" on user_state;

create policy "user_state read own"
  on user_state for select
  using (auth.uid() = user_id);

create policy "user_state insert own"
  on user_state for insert
  with check (auth.uid() = user_id);

create policy "user_state update own"
  on user_state for update
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

create policy "user_state delete own"
  on user_state for delete
  using (auth.uid() = user_id);
