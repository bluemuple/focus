-- ============================================================================
-- Bidoro — comments / replies on the anonymous shared memos
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor (project sbatsnivlrlywpfytlio),
-- AFTER supabase-shared-memos.sql (it references focus_shared_memos.id).
--
-- A "friend" can leave a short encouraging reply on someone else's shared memo.
-- The author sees it in their top bar ("A friend left a memo.") + on the Notes
-- page, can ♡ it (which pings the replier's app) or report it. An edge function
-- (focus-memo-ai-reply) may also post an AI reply when a memo goes a day with no
-- human reply — flagged is_ai=true so only the owner's admin page reveals it.
--
-- Until this runs, the client wraps every call in try/catch, so commenting just
-- silently no-ops (the rest of the app is unaffected).
-- ============================================================================

create table if not exists public.focus_memo_comments (
  id               bigint generated always as identity primary key,
  memo_id          bigint      not null references public.focus_shared_memos(id) on delete cascade,
  author_client_id text        not null,            -- the replier's random per-device id
  text             text        not null,            -- the reply (<= 200 chars)
  hearted          boolean     not null default false,   -- owner ♡'d it → ping the replier
  reported         boolean     not null default false,   -- someone reported it
  is_ai            boolean     not null default false,   -- posted by the AI auto-reply edge fn
  created_at       timestamptz not null default now()
);

create index if not exists focus_memo_comments_memo_idx    on public.focus_memo_comments (memo_id, created_at desc);
create index if not exists focus_memo_comments_author_idx  on public.focus_memo_comments (author_client_id, created_at desc);

-- How many other users a single memo may be shown to (null = unlimited). The
-- admin page (shared.html) edits this; the client caps its rotation pool by it.
alter table public.focus_shared_memos add column if not exists max_viewers int;

grant select, insert, update, delete on public.focus_memo_comments to anon, authenticated;

alter table public.focus_memo_comments enable row level security;

-- Anyone may READ every comment (the client filters to "mine" vs "to me").
drop policy if exists "memo_comments_select" on public.focus_memo_comments;
create policy "memo_comments_select"
  on public.focus_memo_comments for select
  to anon, authenticated
  using (true);

-- Anyone may INSERT a reply (length-capped as a backstop).
drop policy if exists "memo_comments_insert" on public.focus_memo_comments;
create policy "memo_comments_insert"
  on public.focus_memo_comments for insert
  to anon, authenticated
  with check (char_length(text) between 1 and 200);

-- Anyone may UPDATE — needed for ♡ (hearted) + report toggles. Fully anonymous
-- board, same trade-off as the memos table; harden with an edge function later.
drop policy if exists "memo_comments_update" on public.focus_memo_comments;
create policy "memo_comments_update"
  on public.focus_memo_comments for update
  to anon, authenticated
  using (true)
  with check (true);

-- DELETE allowed (owner pruning / moderation).
drop policy if exists "memo_comments_delete" on public.focus_memo_comments;
create policy "memo_comments_delete"
  on public.focus_memo_comments for delete
  to anon, authenticated
  using (true);
