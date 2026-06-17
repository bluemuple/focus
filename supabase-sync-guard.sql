-- ============================================================================
--  Bidoro — SYNC ACCOUNT SAFETY GUARD
--  One iCloud sync group (an app-specific UUID shared across a user's Apple
--  devices via iCloud) may be linked to ONLY ONE Bidoro web account. This
--  prevents two different web accounts from both connecting to the same iCloud
--  data. Deploy: paste into the Supabase SQL editor (project sbatsnivlrlywpfytlio)
--  and run. Idempotent — safe to re-run.
--
--  All access via SECURITY DEFINER RPCs (direct table access revoked), mirroring
--  the focus_profiles / focus_friendships pattern already in the project.
-- ============================================================================

create table if not exists public.sync_account_bindings (
  id                   bigint generated always as identity primary key,
  icloud_sync_group_id text not null,
  web_user_id          text not null,                 -- auth.uid()::text of the linked web account
  web_email            text,                          -- for friendly warning copy only
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  last_seen_device_id  text
);
-- ONE web account per iCloud sync group (the whole point of the guard).
create unique index if not exists sync_account_bindings_group_uidx
  on public.sync_account_bindings (icloud_sync_group_id);

alter table public.sync_account_bindings enable row level security;
revoke all on public.sync_account_bindings from anon, authenticated;

-- ---- helper (reused name is fine — create or replace) ----
create or replace function public._focus_uid() returns text
language sql stable as $$ select nullif(auth.uid()::text, '') $$;

-- Read the binding for an iCloud sync group (the caller's device holds this UUID
-- in its iCloud store). Returns the linked account so the client can compare.
create or replace function public.focus_sync_binding_get(p_group text)
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid(); r record;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_group is null or length(trim(p_group)) = 0 then return json_build_object('ok', true, 'bound', false); end if;
  select * into r from sync_account_bindings where icloud_sync_group_id = p_group;
  if r is null then return json_build_object('ok', true, 'bound', false); end if;
  return json_build_object('ok', true, 'bound', true,
    'web_user_id', r.web_user_id, 'web_email', r.web_email,
    'mine', (r.web_user_id = uid));
end $$;

-- Create the binding for the current web user. FIRST WRITER WINS: if a binding
-- already exists it is NOT overwritten — we return the existing one so the client
-- can show the conflict modal. If it already belongs to the caller, we just touch
-- last_seen. The unique index makes the insert race-safe across devices.
create or replace function public.focus_sync_binding_create(p_group text, p_email text, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid(); r record;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_group is null or length(trim(p_group)) = 0 then return json_build_object('ok', false, 'error', 'no_group'); end if;
  -- race-safe: insert only if absent; the unique index guarantees one winner.
  insert into sync_account_bindings (icloud_sync_group_id, web_user_id, web_email, last_seen_device_id)
    values (p_group, uid, p_email, p_device)
  on conflict (icloud_sync_group_id) do nothing;
  select * into r from sync_account_bindings where icloud_sync_group_id = p_group;
  if r is null then return json_build_object('ok', false, 'error', 'failed'); end if;
  if r.web_user_id = uid then
    update sync_account_bindings set last_seen_device_id = coalesce(p_device, last_seen_device_id),
           web_email = coalesce(p_email, web_email), updated_at = now()
      where icloud_sync_group_id = p_group;
    return json_build_object('ok', true, 'linked', true, 'mine', true,
      'web_user_id', r.web_user_id, 'web_email', coalesce(p_email, r.web_email));
  end if;
  -- A different account got there first → conflict, do NOT overwrite.
  return json_build_object('ok', true, 'linked', false, 'mine', false, 'conflict', true,
    'web_user_id', r.web_user_id, 'web_email', r.web_email);
end $$;

-- Advanced / settings-only: disconnect THIS group from the caller's account. Only
-- the linked account may unlink. Does not delete or merge any user data.
create or replace function public.focus_sync_binding_unlink(p_group text)
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid(); r record;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into r from sync_account_bindings where icloud_sync_group_id = p_group;
  if r is null then return json_build_object('ok', true, 'bound', false); end if;
  if r.web_user_id <> uid then return json_build_object('ok', false, 'error', 'not_owner', 'web_email', r.web_email); end if;
  delete from sync_account_bindings where icloud_sync_group_id = p_group and web_user_id = uid;
  return json_build_object('ok', true, 'unlinked', true);
end $$;

grant execute on function
  public.focus_sync_binding_get(text),
  public.focus_sync_binding_create(text,text,text),
  public.focus_sync_binding_unlink(text)
  to anon, authenticated;
