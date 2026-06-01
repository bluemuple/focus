-- ============================================================================
-- Bidoro — anonymous "Memo for Sharing" board
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor (project sbatsnivlrlywpfytlio).
-- It creates a public table that any visitor (anon key, NO sign-in) can read
-- and write a single memo into. Each memo rotates into every user's top-bar
-- motivational-quote slot; memos from other users render green in the app.
--
-- Until this runs, the app's sharing features silently no-op (the client wraps
-- every call in try/catch) — only your own quotes + your own memo rotate.
-- ============================================================================

create table if not exists public.focus_shared_memos (
  id          bigint generated always as identity primary key,
  client_id   text        not null,            -- random per-device id (the upsert key)
  text        text        not null,            -- the shared memo (<= ~100 chars from the client)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One memo per anonymous client → the upsert conflict target.
create unique index if not exists focus_shared_memos_client_uidx
  on public.focus_shared_memos (client_id);

-- Most-recent-first reads.
create index if not exists focus_shared_memos_created_idx
  on public.focus_shared_memos (created_at desc);

-- The anon / authenticated roles need table privileges in addition to the RLS
-- policies below (RLS gates rows; GRANT gates the operation).
grant select, insert, update, delete on public.focus_shared_memos to anon, authenticated;

alter table public.focus_shared_memos enable row level security;

-- Anyone may READ every memo.
drop policy if exists "shared_memos_select" on public.focus_shared_memos;
create policy "shared_memos_select"
  on public.focus_shared_memos for select
  to anon, authenticated
  using (true);

-- Anyone may INSERT a memo (length-capped server-side as a backstop).
drop policy if exists "shared_memos_insert" on public.focus_shared_memos;
create policy "shared_memos_insert"
  on public.focus_shared_memos for insert
  to anon, authenticated
  with check (char_length(text) between 1 and 200);

-- Anyone may UPDATE / DELETE — needed for upsert ("edit my memo") and "clear my
-- memo". Because the board is fully anonymous there is no server-side owner
-- check; the client only ever targets its own random client_id. This is the
-- accepted trade-off of "no sign-up" sharing. Harden later with an edge
-- function + per-row token if abuse appears.
drop policy if exists "shared_memos_update" on public.focus_shared_memos;
create policy "shared_memos_update"
  on public.focus_shared_memos for update
  to anon, authenticated
  using (true)
  with check (char_length(text) between 1 and 200);

drop policy if exists "shared_memos_delete" on public.focus_shared_memos;
create policy "shared_memos_delete"
  on public.focus_shared_memos for delete
  to anon, authenticated
  using (true);

-- Optional later hardening:
--   • scheduled cleanup of stale rows (e.g. delete where updated_at < now() - interval '90 days')
--   • a moderation/flagged column + a trigger
--   • move writes behind a rate-limited edge function instead of direct anon writes
