begin;

create table public.ledger_profiles (
  id uuid primary key references auth.users(id),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  version integer not null default 1 check (version > 0)
);
create table public.ledger_trips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  owner_id uuid not null references public.ledger_profiles(id),
  exchange_rate numeric(14,8) check (exchange_rate > 0),
  version integer not null default 1,
  created_at timestamptz not null default now()
);
create table public.ledger_members (
  trip_id uuid not null references public.ledger_trips(id),
  user_id uuid not null references public.ledger_profiles(id),
  slot smallint not null check (slot in (1,2)),
  primary key (trip_id,user_id), unique (trip_id,slot)
);
create table public.ledger_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.ledger_trips(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  redeemed_by uuid references public.ledger_profiles(id),
  revoked_at timestamptz
);
create table public.ledger_expenses (
  id uuid primary key,
  trip_id uuid not null references public.ledger_trips(id),
  title text not null check (char_length(btrim(title)) between 1 and 150),
  amount_jpy integer not null check (amount_jpy between 1 and 1000000000),
  payer_id uuid not null,
  member_one_id uuid not null,
  member_two_id uuid not null,
  share_one_jpy integer not null check (share_one_jpy >= 0),
  share_two_jpy integer not null check (share_two_jpy >= 0),
  split_mode text not null check (split_mode in ('equal','single','custom')),
  spent_on date not null,
  category text not null check (category in ('餐飲','交通','門票','住宿','購物','其他')),
  notes text not null default '' check (char_length(notes) <= 5000),
  version integer not null default 1,
  updated_by uuid not null references public.ledger_profiles(id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (member_one_id <> member_two_id),
  check (share_one_jpy + share_two_jpy = amount_jpy),
  foreign key (trip_id,payer_id) references public.ledger_members(trip_id,user_id),
  foreign key (trip_id,member_one_id) references public.ledger_members(trip_id,user_id),
  foreign key (trip_id,member_two_id) references public.ledger_members(trip_id,user_id)
);
create table public.ledger_settlements (
  id uuid primary key,
  trip_id uuid not null references public.ledger_trips(id),
  payer_id uuid not null,
  receiver_id uuid not null,
  amount_jpy integer not null check (amount_jpy between 1 and 1000000000),
  paid_on date not null,
  notes text not null default '' check (char_length(notes) <= 5000),
  version integer not null default 1,
  updated_by uuid not null references public.ledger_profiles(id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (payer_id <> receiver_id),
  foreign key (trip_id,payer_id) references public.ledger_members(trip_id,user_id),
  foreign key (trip_id,receiver_id) references public.ledger_members(trip_id,user_id)
);
create table public.ledger_requests (
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_id,request_id)
);
create index ledger_members_user on public.ledger_members(user_id);
create index ledger_expenses_trip on public.ledger_expenses(trip_id,spent_on) where deleted_at is null;
create index ledger_settlements_trip on public.ledger_settlements(trip_id,paid_on) where deleted_at is null;

create function public.ledger_is_member(p_trip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.ledger_members where trip_id=p_trip and user_id=auth.uid());
$$;
revoke all on function public.ledger_is_member(uuid) from public, anon;
grant execute on function public.ledger_is_member(uuid) to authenticated;

alter table public.ledger_profiles enable row level security;
alter table public.ledger_trips enable row level security;
alter table public.ledger_members enable row level security;
alter table public.ledger_invites enable row level security;
alter table public.ledger_expenses enable row level security;
alter table public.ledger_settlements enable row level security;
alter table public.ledger_requests enable row level security;
create policy ledger_profile_read on public.ledger_profiles for select to authenticated using (
  id=auth.uid() or exists(select 1 from public.ledger_members m where m.user_id=id and public.ledger_is_member(m.trip_id))
);
create policy ledger_trip_read on public.ledger_trips for select to authenticated using (public.ledger_is_member(id));
create policy ledger_member_read on public.ledger_members for select to authenticated using (public.ledger_is_member(trip_id));
create policy ledger_expense_read on public.ledger_expenses for select to authenticated using (public.ledger_is_member(trip_id));
create policy ledger_settlement_read on public.ledger_settlements for select to authenticated using (public.ledger_is_member(trip_id));
revoke all on public.ledger_profiles, public.ledger_trips, public.ledger_members, public.ledger_invites, public.ledger_expenses, public.ledger_settlements, public.ledger_requests from public, anon, authenticated;
grant select on public.ledger_profiles, public.ledger_trips, public.ledger_members, public.ledger_expenses, public.ledger_settlements to authenticated;

-- Every write passes through this transaction. There are no client DML grants.
create function public.ledger_yen(v text, allow_zero boolean default false) returns integer
language plpgsql immutable set search_path = '' as $$
declare n numeric;
begin
  if v is null or v !~ '^[0-9]{1,10}$' then raise exception '日圓須為整數' using errcode='22023'; end if;
  n := v::numeric;
  if n < (case when allow_zero then 0 else 1 end) or n>1000000000 then raise exception '日圓金額超出範圍' using errcode='22023'; end if;
  return n::integer;
end $$;
revoke all on function public.ledger_yen(text,boolean) from public, anon, authenticated;

create function public.ledger_command(p_request_id uuid, p_action text, p_trip_id uuid default null, p_expected_version integer default null, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
<<ledger_write>>
declare
  actor uuid := auth.uid(); signature text; old_request public.ledger_requests%rowtype;
  t public.ledger_trips%rowtype; i public.ledger_invites%rowtype;
  e public.ledger_expenses%rowtype; s public.ledger_settlements%rowtype;
  trip uuid := p_trip_id; result jsonb; record_id uuid; one_id uuid; two_id uuid; payer uuid; receiver uuid;
  amount integer; one_share integer; two_share integer; mode text; title text; memo text; event_date date; token text; rate_text text;
begin
  if actor is null then raise exception '請先登入' using errcode='42501'; end if;
  if p_request_id is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception '請求格式不正確' using errcode='22023'; end if;
  signature := encode(sha256(convert_to(jsonb_build_array(p_action,p_trip_id,p_expected_version,p_payload)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_request_id::text,0));
  select * into old_request from public.ledger_requests where actor_id=actor and request_id=p_request_id;
  if found then
    if old_request.payload_hash<>signature then raise exception '重送識別碼與內容不一致，請重新確認操作' using errcode='22023'; end if;
    return old_request.result;
  end if;

  if p_action='profile' then
    title := btrim(p_payload->>'name');
    if title is null or char_length(title) not between 1 and 40 then raise exception '顯示名稱須為 1–40 字' using errcode='22023'; end if;
    if p_expected_version is null then
      insert into public.ledger_profiles(id,display_name) values(actor,title) on conflict do nothing;
      if not found then raise exception '名稱已變更，請重新同步' using errcode='40001'; end if;
    else
      update public.ledger_profiles set display_name=title,version=version+1 where id=actor and version=p_expected_version;
      if not found then raise exception '名稱已變更，請重新同步' using errcode='40001'; end if;
    end if;
    result := jsonb_build_object('ok',true);
  else
    if not exists(select 1 from public.ledger_profiles where id=actor) then raise exception '請先設定顯示名稱' using errcode='22023'; end if;
    if p_action='create_trip' then
      title := btrim(p_payload->>'title');
      if title is null or char_length(title) not between 1 and 100 then raise exception '旅程名稱須為 1–100 字' using errcode='22023'; end if;
      insert into public.ledger_trips(title,owner_id) values(title,actor) returning id into trip;
      insert into public.ledger_members(trip_id,user_id,slot) values(trip,actor,1);
      result := jsonb_build_object('trip_id',trip);
    else
      if p_action='join_trip' then
        token := lower(btrim(p_payload->>'token'));
        if token is null or token !~ '^[a-f0-9]{64}$' then raise exception '邀請碼無效、已使用或已過期' using errcode='22023'; end if;
        select trip_id into trip from public.ledger_invites where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
      end if;
      -- All trip writes use the same parent row lock. Invite redemption cannot race a third member into the trip.
      select * into t from public.ledger_trips where id=trip for update;
      if not found then raise exception '無法存取此旅程或邀請已失效' using errcode='42501'; end if;
      if p_action='join_trip' then
        select * into i from public.ledger_invites where trip_id=trip and token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
        if not found or i.expires_at<=clock_timestamp() or i.revoked_at is not null or i.redeemed_by is not null then raise exception '邀請碼無效、已使用或已過期' using errcode='22023'; end if;
        if exists(select 1 from public.ledger_members where trip_id=trip and user_id=actor) then raise exception '你已是此旅程成員' using errcode='22023'; end if;
        if (select count(*) from public.ledger_members where trip_id=trip)<>1 then raise exception '每趟旅程最多兩人' using errcode='22023'; end if;
        insert into public.ledger_members(trip_id,user_id,slot) values(trip,actor,2);
        update public.ledger_invites set redeemed_by=actor where id=i.id;
        update public.ledger_trips set version=version+1 where id=trip;
        result := jsonb_build_object('trip_id',trip);
      else
        if not public.ledger_is_member(trip) then raise exception '你不是此旅程成員' using errcode='42501'; end if;
        if p_action='create_invite' then
          if t.owner_id<>actor then raise exception '只有建立旅程者可邀請旅伴' using errcode='42501'; end if;
          if (select count(*) from public.ledger_members where trip_id=trip)<>1 then raise exception '這趟旅程已有兩位成員' using errcode='22023'; end if;
          token := lower(btrim(p_payload->>'token'));
          if token is null or token !~ '^[a-f0-9]{64}$' then raise exception '邀請碼格式不正確' using errcode='22023'; end if;
          update public.ledger_invites set revoked_at=now() where trip_id=trip and redeemed_by is null and revoked_at is null;
          insert into public.ledger_invites(trip_id,token_hash,expires_at) values(trip,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '24 hours') returning * into i;
          result := jsonb_build_object('invite_id',i.id,'expires_at',i.expires_at);
        elsif p_action='revoke_invite' then
          if t.owner_id<>actor then raise exception '只有建立旅程者可撤銷邀請' using errcode='42501'; end if;
          update public.ledger_invites set revoked_at=now() where trip_id=trip and id=(p_payload->>'id')::uuid and revoked_at is null;
          result := jsonb_build_object('ok',true);
        elsif p_action='set_rate' then
          if p_expected_version is null or t.version<>p_expected_version then raise exception '共同匯率已變更，請重新同步後確認' using errcode='40001'; end if;
          rate_text := p_payload->>'rate';
          if rate_text is null or rate_text !~ '^[0-9]{1,6}(\.[0-9]{1,8})?$' or rate_text::numeric<=0 then raise exception '匯率須大於 0，最多 6 位整數、8 位小數' using errcode='22023'; end if;
          update public.ledger_trips set exchange_rate=rate_text::numeric,version=version+1 where id=trip;
          result := jsonb_build_object('ok',true);
        elsif p_action in ('save_expense','delete_expense','save_settlement','delete_settlement') then
          select user_id into one_id from public.ledger_members where trip_id=trip and slot=1;
          select user_id into two_id from public.ledger_members where trip_id=trip and slot=2;
          if one_id is null or two_id is null then raise exception '請先邀請另一位真實旅伴加入' using errcode='22023'; end if;
          record_id := (p_payload->>'id')::uuid;
          if record_id is null then raise exception '缺少紀錄識別碼' using errcode='22023'; end if;
          if p_action in ('save_expense','delete_expense') then
            select * into e from public.ledger_expenses where id=record_id and trip_id=trip;
            if found then
              if p_expected_version is null or e.version<>p_expected_version or e.deleted_at is not null then raise exception '此消費已被修改或刪除，請重新同步後再確認' using errcode='40001'; end if;
            elsif p_expected_version is not null or p_action='delete_expense' then raise exception '此消費已變更或無法存取' using errcode='40001'; end if;
          else
            select * into s from public.ledger_settlements where id=record_id and trip_id=trip;
            if found then
              if p_expected_version is null or s.version<>p_expected_version or s.deleted_at is not null then raise exception '此結算已被修改或刪除，請重新同步後再確認' using errcode='40001'; end if;
            elsif p_expected_version is not null or p_action='delete_settlement' then raise exception '此結算已變更或無法存取' using errcode='40001'; end if;
          end if;
          if p_action='delete_expense' then
            update public.ledger_expenses set deleted_at=now(),version=version+1,updated_by=actor,updated_at=now() where id=record_id and trip_id=trip;
          elsif p_action='delete_settlement' then
            update public.ledger_settlements set deleted_at=now(),version=version+1,updated_by=actor,updated_at=now() where id=record_id and trip_id=trip;
          else
            amount := public.ledger_yen(p_payload->>'amount_jpy');
            payer := (p_payload->>'payer_id')::uuid;
            if payer is null or payer not in (one_id,two_id) then raise exception '付款人必須是旅程成員' using errcode='22023'; end if;
            if coalesce(p_payload->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception '日期格式不正確' using errcode='22023'; end if;
            event_date := (p_payload->>'date')::date;
            memo := coalesce(p_payload->>'notes','');
            if char_length(memo)>5000 then raise exception '備註最多 5000 字' using errcode='22023'; end if;
            if p_action='save_expense' then
              title := btrim(p_payload->>'title'); mode := p_payload->>'split_mode';
              if title is null or char_length(title) not between 1 and 150 then raise exception '消費名稱須為 1–150 字' using errcode='22023'; end if;
              if coalesce(p_payload->>'category','') not in ('餐飲','交通','門票','住宿','購物','其他') then raise exception '分類不正確' using errcode='22023'; end if;
              if mode='equal' then
                one_share := amount/2 + case when payer=one_id then amount%2 else 0 end;
                two_share := amount-one_share;
              elsif mode='single' then
                receiver := (p_payload->>'single_member_id')::uuid;
                if receiver is null or receiver not in (one_id,two_id) then raise exception '負擔者必須是旅程成員' using errcode='22023'; end if;
                one_share := case when receiver=one_id then amount else 0 end; two_share := amount-one_share;
              elsif mode='custom' then
                if jsonb_typeof(p_payload->'shares') is distinct from 'object' or (select count(*) from jsonb_object_keys(p_payload->'shares'))<>2 then raise exception '自訂分攤須包含兩位成員' using errcode='22023'; end if;
                one_share := public.ledger_yen(p_payload->'shares'->>one_id::text,true);
                two_share := public.ledger_yen(p_payload->'shares'->>two_id::text,true);
                if one_share+two_share<>amount then raise exception '分攤合計必須等於消費金額' using errcode='22023'; end if;
              else raise exception '分攤方式不正確' using errcode='22023'; end if;
              if e.id is null then
                insert into public.ledger_expenses(id,trip_id,title,amount_jpy,payer_id,member_one_id,member_two_id,share_one_jpy,share_two_jpy,split_mode,spent_on,category,notes,updated_by)
                values(record_id,trip,title,amount,payer,one_id,two_id,one_share,two_share,mode,event_date,p_payload->>'category',memo,actor);
              else
                update public.ledger_expenses set title=ledger_write.title,amount_jpy=amount,payer_id=payer,share_one_jpy=one_share,share_two_jpy=two_share,split_mode=mode,spent_on=event_date,category=p_payload->>'category',notes=memo,version=version+1,updated_by=actor,updated_at=now() where id=record_id and trip_id=trip;
              end if;
            else
              receiver := (p_payload->>'receiver_id')::uuid;
              if receiver is null or receiver not in (one_id,two_id) or receiver=payer then raise exception '結算雙方必須是不同旅伴' using errcode='22023'; end if;
              if s.id is null then
                insert into public.ledger_settlements(id,trip_id,payer_id,receiver_id,amount_jpy,paid_on,notes,updated_by) values(record_id,trip,payer,receiver,amount,event_date,memo,actor);
              else
                update public.ledger_settlements set payer_id=payer,receiver_id=receiver,amount_jpy=amount,paid_on=event_date,notes=memo,version=version+1,updated_by=actor,updated_at=now() where id=record_id and trip_id=trip;
              end if;
            end if;
          end if;
          result := jsonb_build_object('ok',true,'id',record_id);
        else raise exception '不支援的操作' using errcode='22023'; end if;
      end if;
    end if;
  end if;
  insert into public.ledger_requests(actor_id,request_id,payload_hash,result) values(actor,p_request_id,signature,result);
  return result;
end $$;
revoke all on function public.ledger_command(uuid,text,uuid,integer,jsonb) from public, anon;
grant execute on function public.ledger_command(uuid,text,uuid,integer,jsonb) to authenticated;

create function public.ledger_snapshot(p_trip_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); selected uuid:=p_trip_id; output jsonb;
begin
  if actor is null then raise exception '請先登入' using errcode='42501'; end if;
  if selected is null then select trip_id into selected from public.ledger_members where user_id=actor order by trip_id limit 1; end if;
  if selected is not null and not public.ledger_is_member(selected) then raise exception '你不是此旅程成員' using errcode='42501'; end if;
  select jsonb_build_object(
    'schema_version',1,
    'profile',(select jsonb_build_object('id',id,'name',display_name,'version',version) from public.ledger_profiles where id=actor),
    'trips',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'owner_id',t.owner_id,'rate',t.exchange_rate::text,'version',t.version) order by t.created_at) from public.ledger_trips t join public.ledger_members m on m.trip_id=t.id where m.user_id=actor),'[]'::jsonb),
    'trip',(select jsonb_build_object('id',id,'title',title,'owner_id',owner_id,'rate',exchange_rate::text,'version',version) from public.ledger_trips where id=selected),
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.display_name,'slot',m.slot) order by m.slot) from public.ledger_members m join public.ledger_profiles p on p.id=m.user_id where m.trip_id=selected),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'trip_id',trip_id,'title',title,'amount_jpy',amount_jpy,'payer_id',payer_id,'date',to_char(spent_on,'YYYY-MM-DD'),'split_mode',split_mode,'shares',jsonb_build_object(member_one_id::text,share_one_jpy,member_two_id::text,share_two_jpy),'category',category,'notes',notes,'version',version) order by spent_on,updated_at) from public.ledger_expenses where trip_id=selected and deleted_at is null),'[]'::jsonb),
    'settlements',coalesce((select jsonb_agg(jsonb_build_object('id',id,'trip_id',trip_id,'payer_id',payer_id,'receiver_id',receiver_id,'amount_jpy',amount_jpy,'date',to_char(paid_on,'YYYY-MM-DD'),'notes',notes,'version',version) order by paid_on,updated_at) from public.ledger_settlements where trip_id=selected and deleted_at is null),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'expires_at',i.expires_at,'used',i.redeemed_by is not null,'revoked',i.revoked_at is not null)) from public.ledger_invites i join public.ledger_trips t on t.id=i.trip_id where i.trip_id=selected and t.owner_id=actor),'[]'::jsonb)
  ) into output;
  return output;
end $$;
revoke all on function public.ledger_snapshot(uuid) from public, anon;
grant execute on function public.ledger_snapshot(uuid) to authenticated;

-- No public invite hashes/request results, and no hard-delete stream of private data.
do $$
declare tab text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach tab in array array['ledger_profiles','ledger_trips','ledger_members','ledger_expenses','ledger_settlements'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tab) then
        execute format('alter publication supabase_realtime add table public.%I',tab);
      end if;
    end loop;
  end if;
end $$;
commit;
