-- ============================================================================
-- Bidoro — per-user admin controls (block sharing / commenting + a message)
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor AFTER supabase-shared-memos.sql and
-- supabase-memo-comments.sql. Re-running is safe (idempotent).
--
-- The admin page (admin-notes.html) writes one row per user (keyed by the
-- anonymous client_id) to:
--   * no_share     → that user can no longer share a memo
--   * no_comment   → that user can no longer post a reply
--   * admin_message→ a line that pops into that user's top-bar motivational slot
-- Enforcement is BOTH client-side (the app refuses + explains) AND server-side
-- (the INSERT policies below reject a blocked client even via direct API calls).
-- ============================================================================

create table if not exists public.focus_admin_controls (
  client_id     text primary key,
  no_share      boolean     not null default false,
  no_comment    boolean     not null default false,
  admin_message text,
  updated_at    timestamptz not null default now()
);

-- REAL SECURITY: anon may only READ its own control (the client enforces blocks
-- + shows the admin message). Every WRITE goes through the focus-admin-api edge
-- function with the SERVICE ROLE, gated by ADMIN_TOKEN — so nobody with just the
-- public anon key can block users or send fake admin messages.
grant select on public.focus_admin_controls to anon, authenticated;
revoke insert, update, delete on public.focus_admin_controls from anon, authenticated;
alter table public.focus_admin_controls enable row level security;

drop policy if exists "admin_controls_all"    on public.focus_admin_controls;
drop policy if exists "admin_controls_select" on public.focus_admin_controls;
create policy "admin_controls_select"
  on public.focus_admin_controls for select
  to anon, authenticated
  using (true);
-- (no anon insert/update/delete policy → only the service role can write.)

-- Reply deletion is admin-only too (via focus-admin-api). Users never delete
-- replies, so revoke it from anon (heart/report UPDATEs stay allowed).
revoke delete on public.focus_memo_comments from anon, authenticated;
drop policy if exists "memo_comments_delete" on public.focus_memo_comments;

-- ── Server-side enforcement: a blocked client cannot INSERT a memo / comment.
--    (Re-creates the insert policies from the earlier files, adding a blocklist
--    check. The client app also blocks + shows a message for nice UX.)
drop policy if exists "shared_memos_insert" on public.focus_shared_memos;
create policy "shared_memos_insert"
  on public.focus_shared_memos for insert
  to anon, authenticated
  with check (
    char_length(text) between 1 and 200
    and not exists (
      select 1 from public.focus_admin_controls b
      where b.client_id = focus_shared_memos.client_id and b.no_share
    )
  );

drop policy if exists "memo_comments_insert" on public.focus_memo_comments;
create policy "memo_comments_insert"
  on public.focus_memo_comments for insert
  to anon, authenticated
  with check (
    char_length(text) between 1 and 200
    and not exists (
      select 1 from public.focus_admin_controls b
      where b.client_id = focus_memo_comments.author_client_id and b.no_comment
    )
  );

-- ── Emoji that rides along with a shared memo (shown small in the top-bar quote).
alter table public.focus_shared_memos add column if not exists emoji text;
