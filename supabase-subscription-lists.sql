-- ============================================================================
-- Bidoro — Subscriptions: topic lists (admin-published) + user-made lists.
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor. Pairs with:
--   • focus-admin-api edge function (publish / approve / list — service role)
--   • the app (anon): reads APPROVED lists, INSERTs pending user lists, and
--     calls focus_subscribe_list() to bump a subscribe count.
-- Security model mirrors supabase-admin-controls.sql: anon can ONLY read
-- approved lists + insert its own pending user list; every privileged write
-- (publish topic, approve, delete) goes through the edge function.
-- ============================================================================

create table if not exists public.focus_subscription_lists (
  id              bigint generated always as identity primary key,
  kind            text   not null default 'user',          -- 'topic' (admin) | 'user'
  name            text   not null,                          -- topic name or list name
  lines           text[] not null default '{}',            -- the quotes (1 per element)
  author_name     text,                                     -- "Made by …" for user lists
  client_id       text,                                     -- submitting device (user lists)
  approved        boolean not null default false,           -- topics are seeded approved=true
  subscribe_count integer not null default 0,
  created_at      timestamptz not null default now(),
  constraint focus_sub_kind_chk check (kind in ('topic','user'))
);

create index if not exists focus_sub_approved_idx on public.focus_subscription_lists (approved, kind);
create index if not exists focus_sub_client_idx   on public.focus_subscription_lists (client_id);

alter table public.focus_subscription_lists enable row level security;

-- Drop old policies (idempotent re-run).
drop policy if exists focus_sub_read   on public.focus_subscription_lists;
drop policy if exists focus_sub_insert on public.focus_subscription_lists;

-- anon (the app) may READ only APPROVED lists.
create policy focus_sub_read on public.focus_subscription_lists
  for select using (approved = true);

-- anon may INSERT only its OWN PENDING user list (never a topic, never pre-approved).
create policy focus_sub_insert on public.focus_subscription_lists
  for insert with check (kind = 'user' and approved = false);

-- No anon UPDATE / DELETE — those happen via the edge function (service role) or
-- the SECURITY DEFINER subscribe RPC below.
revoke update, delete on public.focus_subscription_lists from anon;

-- ---- Subscribe: bump the count without granting UPDATE to anon. ----
create or replace function public.focus_subscribe_list(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.focus_subscription_lists
     set subscribe_count = subscribe_count + 1
   where id = p_id and approved = true;
$$;
grant execute on function public.focus_subscribe_list(bigint) to anon, authenticated;

-- ---- Seed the 3 admin topics (10 quotes each). Safe to re-run (skips if present). ----
insert into public.focus_subscription_lists (kind, name, lines, approved)
select 'topic', 'Self-help', array[
  'Start where you are.', 'Small steps still move you forward.', 'Progress, not perfection.',
  'You can begin again at any moment.', 'Rest is part of the work.', 'Be kind to the version of you that is trying.',
  'One thing at a time is enough.', 'Done is better than perfect.', 'Your pace is the right pace.', 'Tomorrow is a fresh page.'
], true
where not exists (select 1 from public.focus_subscription_lists where kind='topic' and name='Self-help');

insert into public.focus_subscription_lists (kind, name, lines, approved)
select 'topic', 'Motivation', array[
  'Discipline is choosing what you want most.', 'The hard part is starting — begin badly.', 'Show up, especially when it is dull.',
  'Momentum beats motivation.', 'Focus on the next five minutes.', 'You have done hard things before.',
  'Win the morning, win the day.', 'Effort compounds quietly.', 'Make it easy to start.', 'Future you is watching — make them proud.'
], true
where not exists (select 1 from public.focus_subscription_lists where kind='topic' and name='Motivation');

insert into public.focus_subscription_lists (kind, name, lines, approved)
select 'topic', 'Thoughts', array[
  'Not every thought deserves your attention.', 'Feelings are visitors, not residents.', 'You are not your to-do list.',
  'Slow is smooth, smooth is fast.', 'Attention is the rarest gift you can give.', 'Less, but better.',
  'The quiet mind hears more.', 'What you focus on grows.', 'Let it be simple.', 'Breathe; then decide.'
], true
where not exists (select 1 from public.focus_subscription_lists where kind='topic' and name='Thoughts');

-- ---- Admin-set cap on lines per USER list (default 10). Stored on the existing
-- focus_admin_settings row; granted anon SELECT so the app can read + enforce it. ----
alter table public.focus_admin_settings add column if not exists subs_max_lines int not null default 10;
grant select on public.focus_admin_settings to anon, authenticated;
drop policy if exists focus_admin_settings_read on public.focus_admin_settings;
create policy focus_admin_settings_read on public.focus_admin_settings for select using (true);
