-- ============================================================================
-- Bidoro — Google Calendar OAuth token store (B1: connect)
-- ----------------------------------------------------------------------------
-- One row per Bidoro user (user_id = getEffectiveUserId() on the client).
-- ONLY the gcal-oauth / gcal-sync Edge Functions touch this table — they run
-- with the SERVICE ROLE (bypasses RLS). RLS is enabled with NO anon/auth
-- policies, so the public anon key can never read the refresh token.
--
-- Run once:  (Supabase dashboard → SQL editor, paste + run)
-- ============================================================================
create table if not exists public.focus_gcal_tokens (
  user_id        text primary key,
  refresh_token  text,                 -- long-lived (offline access)
  access_token   text,                 -- short-lived
  token_expiry   timestamptz,          -- when access_token expires
  sync_token     text,                 -- Google incremental syncToken (B3)
  calendar_id    text default 'primary',
  connected_at   timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Lock it down: enable RLS and add NO policies → anon/authenticated get nothing.
-- The Edge Functions use the service role, which bypasses RLS.
alter table public.focus_gcal_tokens enable row level security;
revoke all on public.focus_gcal_tokens from anon, authenticated;

comment on table public.focus_gcal_tokens is
  'Google Calendar OAuth tokens per Bidoro user. Service-role only (gcal-oauth / gcal-sync Edge Functions). RLS on, no policies → never readable via the anon key.';
