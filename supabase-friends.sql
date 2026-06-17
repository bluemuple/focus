-- ============================================================================
--  Bidoro — FRIENDS feature (friend codes, symmetric data-sharing, requests)
--  Deploy: paste into Supabase SQL editor (project sbatsnivlrlywpfytlio) and run.
--
--  Identity = Supabase Auth uid (TEXT, matches user_settings.user_id). Friends
--  only work for signed-in users. All cross-user access goes through SECURITY
--  DEFINER RPCs (direct table access is revoked) so sharing is enforced server
--  side — mirrors the focus_subscribe_list() pattern already in the project.
-- ============================================================================

-- ---- 1. PROFILES: friend code + nickname/avatar + "focusing now" presence ----
create table if not exists public.focus_profiles (
  user_id      text primary key,                         -- auth.uid()::text
  friend_code  text unique not null,
  nickname     text,
  avatar       text,
  focusing     boolean not null default false,           -- a pomodoro is running right now
  focusing_at  timestamptz,                              -- last presence heartbeat
  updated_at   timestamptz not null default now()
);

-- ---- 2. FRIENDSHIPS: one row per pair (user_a < user_b). Sharing flags live
--         here (SYMMETRIC — both friends always share the same sections). -------
create table if not exists public.focus_friendships (
  id             bigint generated always as identity primary key,
  user_a         text not null,
  user_b         text not null,
  requested_by   text not null,
  status         text not null default 'pending',        -- 'pending' | 'accepted'
  share_timeline boolean not null default false,
  share_balance  boolean not null default false,
  share_routine  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists focus_friendships_a_idx on public.focus_friendships (user_a);
create index if not exists focus_friendships_b_idx on public.focus_friendships (user_b);

-- ---- 3. SHARE-CHANGE REQUESTS: turning a section OFF is immediate; turning a
--         section ON needs the other person's approval. want_* = the desired
--         final sharing state to apply on approval. ----------------------------
create table if not exists public.focus_share_requests (
  id             bigint generated always as identity primary key,
  friendship_id  bigint not null references public.focus_friendships(id) on delete cascade,
  from_user      text not null,
  to_user        text not null,
  want_timeline  boolean not null,
  want_balance   boolean not null,
  want_routine   boolean not null,
  message        text,
  status         text not null default 'pending',        -- 'pending' | 'approved' | 'denied'
  reply_message  text,
  created_at     timestamptz not null default now(),
  responded_at   timestamptz
);
create index if not exists focus_share_req_to_idx on public.focus_share_requests (to_user, status);

-- ---- Lock the tables: access ONLY via the RPCs below. ----
alter table public.focus_profiles       enable row level security;
alter table public.focus_friendships    enable row level security;
alter table public.focus_share_requests enable row level security;
revoke all on public.focus_profiles, public.focus_friendships, public.focus_share_requests from anon, authenticated;

-- ============================================================================
--  HELPERS
-- ============================================================================
create or replace function public._focus_uid() returns text
language sql stable as $$ select nullif(auth.uid()::text, '') $$;

-- A short, unambiguous friend code like "K7H-9QX".
create or replace function public._focus_gen_code() returns text
language plpgsql as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int; tries int := 0;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(a, 1 + floor(random()*length(a))::int, 1); end loop;
    c := substr(c,1,3) || '-' || substr(c,4,3);
    exit when not exists (select 1 from public.focus_profiles where friend_code = c);
    tries := tries + 1; if tries > 50 then raise exception 'code gen failed'; end if;
  end loop;
  return c;
end $$;

-- ============================================================================
--  RPCs (SECURITY DEFINER — run as owner, enforce auth.uid() inside)
-- ============================================================================

-- Upsert my profile; auto-creates a friend code on first call. Returns the code.
create or replace function public.focus_profile_upsert(p_nickname text, p_avatar text, p_focusing boolean)
returns text language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid(); code text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select friend_code into code from focus_profiles where user_id = uid;
  if code is null then code := _focus_gen_code(); end if;
  insert into focus_profiles (user_id, friend_code, nickname, avatar, focusing, focusing_at, updated_at)
    values (uid, code, p_nickname, p_avatar, coalesce(p_focusing,false), now(), now())
  on conflict (user_id) do update set
    nickname = coalesce(p_nickname, focus_profiles.nickname),
    avatar   = coalesce(p_avatar,   focus_profiles.avatar),
    focusing = coalesce(p_focusing, focus_profiles.focusing),
    focusing_at = now(), updated_at = now();
  return code;
end $$;

-- Send a friend request by code (or auto-accept a reverse pending). Returns json.
create or replace function public.focus_friend_add(p_code text, p_message text)
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid(); target text; a text; b text; fid bigint; st text; reqby text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select user_id into target from focus_profiles where friend_code = upper(trim(p_code));
  if target is null then return json_build_object('ok',false,'error','no_such_code'); end if;
  if target = uid then return json_build_object('ok',false,'error','self'); end if;
  a := least(uid,target); b := greatest(uid,target);
  select id,status,requested_by into fid,st,reqby from focus_friendships where user_a=a and user_b=b;
  if fid is null then
    insert into focus_friendships (user_a,user_b,requested_by,status) values (a,b,uid,'pending') returning id into fid;
    return json_build_object('ok',true,'status','pending','friendship_id',fid);
  elsif st='accepted' then
    return json_build_object('ok',true,'status','already');
  elsif reqby <> uid then           -- reverse pending exists → accept it
    update focus_friendships set status='accepted', updated_at=now() where id=fid;
    return json_build_object('ok',true,'status','accepted','friendship_id',fid);
  else
    return json_build_object('ok',true,'status','pending','friendship_id',fid);
  end if;
end $$;

-- Accept (p_accept=true) or decline (delete) an incoming friend request.
create or replace function public.focus_friend_respond(p_friendship_id bigint, p_accept boolean)
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid(); reqby text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select requested_by into reqby from focus_friendships
    where id=p_friendship_id and status='pending' and (user_a=uid or user_b=uid);
  if reqby is null then return json_build_object('ok',false,'error','not_found'); end if;
  if reqby = uid then return json_build_object('ok',false,'error','own_request'); end if;
  if p_accept then update focus_friendships set status='accepted', updated_at=now() where id=p_friendship_id;
  else delete from focus_friendships where id=p_friendship_id; end if;
  return json_build_object('ok',true);
end $$;

-- My friends + incoming requests, with the other person's profile. One call.
create or replace function public.focus_friends_list()
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  return json_build_object(
    'me', (select row_to_json(p) from (
            select friend_code, nickname, avatar from focus_profiles where user_id=uid) p),
    'friends', coalesce((
      select json_agg(json_build_object(
        'friendship_id', f.id,
        'other_id', case when f.user_a=uid then f.user_b else f.user_a end,
        'nickname', pr.nickname, 'avatar', pr.avatar,
        'focusing', coalesce(pr.focusing,false) and pr.focusing_at > now() - interval '3 minutes',
        'status', f.status,
        'requested_by_me', (f.requested_by = uid),
        'share_timeline', f.share_timeline, 'share_balance', f.share_balance, 'share_routine', f.share_routine,
        'incoming_share_req', (select row_to_json(x) from (
                                 select sr.id, sr.want_timeline, sr.want_balance, sr.want_routine, sr.message
                                 from focus_share_requests sr
                                 where sr.friendship_id=f.id and sr.to_user=uid and sr.status='pending'
                                 order by sr.id desc limit 1) x)
      ) order by f.status, pr.nickname)
      from focus_friendships f
      left join focus_profiles pr on pr.user_id = (case when f.user_a=uid then f.user_b else f.user_a end)
      where (f.user_a=uid or f.user_b=uid)
    ), '[]'::json)
  );
end $$;

-- Read a friend's shared section. Enforces accepted friendship + the share flag.
-- section: 'timeline' | 'balance' | 'routine'. Timeline STRIPS task names.
create or replace function public.focus_friend_data(p_friend_id text, p_section text)
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid(); a text; b text; f record; us record; blocks jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  a := least(uid,p_friend_id); b := greatest(uid,p_friend_id);
  select * into f from focus_friendships where user_a=a and user_b=b and status='accepted';
  if f is null then return json_build_object('ok',false,'error','not_friends'); end if;
  if (p_section='timeline' and not f.share_timeline)
     or (p_section='balance' and not f.share_balance)
     or (p_section='routine' and not f.share_routine) then
    return json_build_object('ok',false,'error','not_shared');
  end if;
  select tasks, watch_log, session_state into us from user_settings where user_id = p_friend_id;
  if us is null then return json_build_object('ok',true,'empty',true); end if;
  if p_section='timeline' then
    -- strip task names; keep q/taskIdx + segments for colour coding
    select coalesce(jsonb_agg(
             (b2 - 'taskName' - 'trackerName' - 'memo')
           ), '[]'::jsonb)
      into blocks
      from jsonb_array_elements(coalesce(us.session_state->'scheduledBlocks','[]'::jsonb)) b2;
    return json_build_object('ok',true,'scheduledBlocks',blocks);
  elsif p_section='balance' then
    return json_build_object('ok',true,'watch_log',coalesce(us.watch_log,'[]'::jsonb),'tasks',coalesce(us.tasks,'{}'::jsonb));
  else
    return json_build_object('ok',true,'tasks',coalesce(us.tasks,'{}'::jsonb),'watch_log',coalesce(us.watch_log,'[]'::jsonb));
  end if;
end $$;

-- Change sharing. OFF transitions apply immediately; any OFF→ON creates a request.
-- Returns {applied:bool, requested:bool}.
create or replace function public.focus_share_change(p_friendship_id bigint, p_timeline boolean, p_balance boolean, p_routine boolean, p_message text)
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid(); f record; other text; need_req boolean;
        nt boolean; nb boolean; nr boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into f from focus_friendships where id=p_friendship_id and status='accepted' and (user_a=uid or user_b=uid);
  if f is null then return json_build_object('ok',false,'error','not_found'); end if;
  other := case when f.user_a=uid then f.user_b else f.user_a end;
  -- apply OFF immediately (new=false while current=true)
  nt := f.share_timeline; nb := f.share_balance; nr := f.share_routine;
  if not p_timeline and f.share_timeline then nt := false; end if;
  if not p_balance  and f.share_balance  then nb := false; end if;
  if not p_routine  and f.share_routine  then nr := false; end if;
  update focus_friendships set share_timeline=nt, share_balance=nb, share_routine=nr, updated_at=now() where id=f.id;
  -- any OFF→ON needs approval
  need_req := (p_timeline and not f.share_timeline) or (p_balance and not f.share_balance) or (p_routine and not f.share_routine);
  if need_req then
    -- supersede older pending requests from me on this friendship
    update focus_share_requests set status='denied', responded_at=now()
      where friendship_id=f.id and from_user=uid and status='pending';
    insert into focus_share_requests (friendship_id, from_user, to_user, want_timeline, want_balance, want_routine, message)
      values (f.id, uid, other,
              p_timeline or nt, p_balance or nb, p_routine or nr, nullif(trim(coalesce(p_message,'')),''));
  end if;
  return json_build_object('ok',true,'applied',true,'requested',coalesce(need_req,false));
end $$;

-- Respond to an incoming share request. On approve, set the friendship's flags
-- to the requested want_*. Either way the reply message is delivered.
create or replace function public.focus_share_respond(p_request_id bigint, p_accept boolean, p_reply text)
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid(); r record;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into r from focus_share_requests where id=p_request_id and to_user=uid and status='pending';
  if r is null then return json_build_object('ok',false,'error','not_found'); end if;
  if p_accept then
    update focus_friendships set share_timeline=r.want_timeline, share_balance=r.want_balance,
           share_routine=r.want_routine, updated_at=now() where id=r.friendship_id;
  end if;
  update focus_share_requests set status=(case when p_accept then 'approved' else 'denied' end),
         reply_message=nullif(trim(coalesce(p_reply,'')),''), responded_at=now() where id=p_request_id;
  return json_build_object('ok',true);
end $$;

-- A reply waiting for ME (the requester) on requests I sent — for a small toast.
create or replace function public.focus_share_replies()
returns json language plpgsql security definer set search_path = public as $$
declare uid text := _focus_uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  return coalesce((select json_agg(json_build_object('id',id,'status',status,'reply',reply_message))
    from focus_share_requests
    where from_user=uid and status in ('approved','denied') and responded_at > now() - interval '7 days'), '[]'::json);
end $$;

grant execute on function
  public.focus_profile_upsert(text,text,boolean),
  public.focus_friend_add(text,text),
  public.focus_friend_respond(bigint,boolean),
  public.focus_friends_list(),
  public.focus_friend_data(text,text),
  public.focus_share_change(bigint,boolean,boolean,boolean,text),
  public.focus_share_respond(bigint,boolean,text),
  public.focus_share_replies()
  to anon, authenticated;
