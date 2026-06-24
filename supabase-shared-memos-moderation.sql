-- ============================================================================
-- Bidoro — shared-notes MODERATION workflow (status machine)
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor (project sbatsnivlrlywpfytlio),
-- AFTER supabase-shared-memos.sql.
--
-- Adds a moderation status to each shared note so a user's "Share" becomes a
-- request the admin approves:
--   pending  → user pressed Share; waiting for the admin to confirm
--   shared   → admin confirmed; the note is publicly shared (green icon shows)
--   returned → admin sent it back with a message (return_message); user sees it
--   deleted  → admin trashed it (soft delete — kept in the admin "Deleted" tab)
--
-- Backward compatible: old rows (created before this ran) default to 'shared'
-- so nothing already public disappears. The client + admin both degrade
-- gracefully if these columns are missing (try/catch + select fallbacks).
-- ============================================================================

alter table public.focus_shared_memos
  add column if not exists status         text        not null default 'shared',
  add column if not exists return_message text,
  add column if not exists note_id        text,                 -- the client's local note id (maps status back to the right note)
  add column if not exists confirmed_at   timestamptz,
  add column if not exists returned_at    timestamptz,
  add column if not exists deleted_at     timestamptz;

-- Filter the public board / admin lists by status quickly.
create index if not exists focus_shared_memos_status_idx
  on public.focus_shared_memos (status);

-- The client (anon) may set status='pending' on its OWN upsert and read its own
-- row's status/return_message back — the existing permissive insert/update/select
-- policies in supabase-shared-memos.sql already allow this (status is just a
-- column). Confirm / return / soft-delete are admin-only: they run through the
-- focus-admin-api edge function with the SERVICE ROLE, never the anon key.
--
-- NOTE: the insert policy in supabase-shared-memos.sql still checks
--   char_length(text) between 1 and 200
-- which is unaffected — status carries no length constraint.
