-- Additive migration: no legacy ledger_* rows, policies, or functions are changed.
-- Private links are 256-bit bearer capabilities. Only their SHA-256 hashes are retained.
-- Anonymous Auth still issues an authenticated role and a unique auth.uid(); raw anon has no access.
begin;

create table public.shared_ledger_books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  owner_id uuid references auth.users(id) on delete set null,
  exchange_rate numeric(14,8) check (exchange_rate > 0),
  version integer not null default 1 check (version > 0),
  legacy_trip_id uuid unique,
  created_at timestamptz not null default now()
);
create table public.shared_ledger_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.shared_ledger_books(id),
  slot smallint not null check (slot in (1,2)),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  unique(trip_id,slot), unique(trip_id,id)
);
-- Neither this table nor request results are readable or published to Realtime.
create table public.shared_ledger_links (
  trip_id uuid primary key references public.shared_ledger_books(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  generation integer not null default 1,
  rotated_at timestamptz not null default now()
);
create table public.shared_ledger_devices (
  trip_id uuid not null references public.shared_ledger_books(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(trip_id,user_id)
);
create table public.shared_ledger_expenses (
  id uuid primary key,
  trip_id uuid not null references public.shared_ledger_books(id),
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
  notes text not null default '' check (char_length(notes)<=5000),
  version integer not null default 1 check (version>0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (member_one_id<>member_two_id),
  check (share_one_jpy::bigint+share_two_jpy::bigint=amount_jpy),
  foreign key(trip_id,payer_id) references public.shared_ledger_participants(trip_id,id),
  foreign key(trip_id,member_one_id) references public.shared_ledger_participants(trip_id,id),
  foreign key(trip_id,member_two_id) references public.shared_ledger_participants(trip_id,id)
);
create table public.shared_ledger_settlements (
  id uuid primary key,
  trip_id uuid not null references public.shared_ledger_books(id),
  payer_id uuid not null,
  receiver_id uuid not null,
  amount_jpy integer not null check (amount_jpy between 1 and 1000000000),
  paid_on date not null,
  notes text not null default '' check (char_length(notes)<=5000),
  version integer not null default 1 check (version>0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (payer_id<>receiver_id),
  foreign key(trip_id,payer_id) references public.shared_ledger_participants(trip_id,id),
  foreign key(trip_id,receiver_id) references public.shared_ledger_participants(trip_id,id)
);
create table public.shared_ledger_requests (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  trip_id uuid not null references public.shared_ledger_books(id),
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
create index shared_ledger_devices_user on public.shared_ledger_devices(user_id);
create index shared_ledger_expenses_trip on public.shared_ledger_expenses(trip_id,spent_on) where deleted_at is null;
create index shared_ledger_settlements_trip on public.shared_ledger_settlements(trip_id,paid_on) where deleted_at is null;

create function public.shared_ledger_has_access(p_trip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.shared_ledger_devices where trip_id=p_trip and user_id=auth.uid() and revoked_at is null)
$$;
revoke all on function public.shared_ledger_has_access(uuid) from public, anon;
grant execute on function public.shared_ledger_has_access(uuid) to authenticated;

alter table public.shared_ledger_books enable row level security;
alter table public.shared_ledger_participants enable row level security;
alter table public.shared_ledger_links enable row level security;
alter table public.shared_ledger_devices enable row level security;
alter table public.shared_ledger_expenses enable row level security;
alter table public.shared_ledger_settlements enable row level security;
alter table public.shared_ledger_requests enable row level security;
create policy shared_ledger_book_read on public.shared_ledger_books for select to authenticated using(public.shared_ledger_has_access(id));
create policy shared_ledger_participant_read on public.shared_ledger_participants for select to authenticated using(public.shared_ledger_has_access(trip_id));
create policy shared_ledger_expense_read on public.shared_ledger_expenses for select to authenticated using(public.shared_ledger_has_access(trip_id));
create policy shared_ledger_settlement_read on public.shared_ledger_settlements for select to authenticated using(public.shared_ledger_has_access(trip_id));
-- Own revoked rows remain visible so UPDATE events can explicitly notify a revoked device.
create policy shared_ledger_device_read on public.shared_ledger_devices for select to authenticated using(user_id=auth.uid());
revoke all on public.shared_ledger_books, public.shared_ledger_participants, public.shared_ledger_links, public.shared_ledger_devices, public.shared_ledger_expenses, public.shared_ledger_settlements, public.shared_ledger_requests from public, anon, authenticated;
grant select on public.shared_ledger_books, public.shared_ledger_participants, public.shared_ledger_devices, public.shared_ledger_expenses, public.shared_ledger_settlements to authenticated;

create function public.shared_ledger_yen(v text, allow_zero boolean default false) returns integer
language plpgsql immutable set search_path = '' as $$
declare n numeric;
begin
  if v is null or v !~ '^[0-9]{1,10}$' then raise exception '日圓須為整數' using errcode='22023'; end if;
  n := v::numeric;
  if n < (case when allow_zero then 0 else 1 end) or n>1000000000 then raise exception '日圓金額超出範圍' using errcode='22023'; end if;
  return n::integer;
end $$;
revoke all on function public.shared_ledger_yen(text,boolean) from public, anon, authenticated;

create function public.shared_ledger_command(p_request_id uuid, p_action text, p_trip_id uuid default null, p_expected_version integer default null, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
<<shared_write>>
declare
  actor uuid := auth.uid(); signature text; old_request public.shared_ledger_requests%rowtype;
  t public.shared_ledger_books%rowtype;
  e public.shared_ledger_expenses%rowtype; s public.shared_ledger_settlements%rowtype;
  trip uuid := p_trip_id; result jsonb; record_id uuid; one_id uuid; two_id uuid; payer uuid; receiver uuid;
  amount integer; one_share integer; two_share integer; mode text; title text; memo text; event_date date; token text; rate_text text;
  first_name text; second_name text; token_hash text;
begin
  if actor is null then raise exception '背景裝置驗證尚未完成，請重新連線' using errcode='42501'; end if;
  if p_request_id is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception '請求格式不正確' using errcode='22023'; end if;
  if p_action not in ('create_book','open_book','rename_participants','rotate_link','set_rate','save_expense','delete_expense','save_settlement','delete_settlement') then raise exception '不支援的操作' using errcode='22023'; end if;
  if p_action in ('create_book','open_book','rotate_link') then
    token := p_payload->>'token';
    if token is null or token !~ '^[a-f0-9]{64}$' then raise exception '私人旅程連結無效，請使用完整連結' using errcode='22023'; end if;
    token_hash := encode(sha256(convert_to(token,'UTF8')),'hex');
  end if;
  signature := encode(sha256(convert_to(jsonb_build_array(p_action,p_trip_id,p_expected_version,p_payload)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_request_id::text,0));
  select * into old_request from public.shared_ledger_requests where actor_id=actor and request_id=p_request_id;
  if found then
    if old_request.payload_hash<>signature then raise exception '重送識別碼與內容不一致，請重新確認操作' using errcode='22023'; end if;
    -- Cache replay must not bypass link rotation or current device authorization.
    perform 1 from public.shared_ledger_books where id=old_request.trip_id for update;
    if not public.shared_ledger_has_access(old_request.trip_id) then raise exception '此裝置的旅程存取已撤銷，請使用最新私人連結' using errcode='42501'; end if;
    if p_action in ('create_book','open_book','rotate_link') and not exists(select 1 from public.shared_ledger_links l where l.trip_id=old_request.trip_id and l.token_hash=shared_write.token_hash) then raise exception '私人旅程連結已失效，請使用最新連結' using errcode='42501'; end if;
    return old_request.result;
  end if;
  if p_action in ('create_book','rename_participants') then
    if jsonb_typeof(p_payload->'names') is distinct from 'array' or jsonb_array_length(p_payload->'names')<>2 or jsonb_typeof(p_payload->'names'->0)<>'string' or jsonb_typeof(p_payload->'names'->1)<>'string' then raise exception '請設定兩位旅伴的顯示名稱' using errcode='22023'; end if;
    first_name := btrim(p_payload->'names'->>0); second_name := btrim(p_payload->'names'->>1);
    if char_length(first_name) not between 1 and 40 or char_length(second_name) not between 1 and 40 or first_name=second_name then raise exception '兩位旅伴須使用不同名稱，各為 1–40 字' using errcode='22023'; end if;
  end if;
  if p_action='create_book' then
    if p_trip_id is not null or p_expected_version is not null then raise exception '建立帳本請勿指定既有旅程版本' using errcode='22023'; end if;
    title := btrim(p_payload->>'title');
    if title is null or char_length(title) not between 1 and 100 then raise exception '旅程名稱須為 1–100 字' using errcode='22023'; end if;
    insert into public.shared_ledger_books(title,owner_id) values(title,actor) returning id into trip;
    insert into public.shared_ledger_participants(trip_id,slot,name) values(trip,1,first_name),(trip,2,second_name);
    insert into public.shared_ledger_links(trip_id,token_hash) values(trip,shared_write.token_hash);
    insert into public.shared_ledger_devices(trip_id,user_id) values(trip,actor);
    result := jsonb_build_object('trip_id',trip,'version',1);
  else
    if p_action='open_book' then
      if p_trip_id is not null or p_expected_version is not null then raise exception '開啟私人連結請勿指定旅程版本' using errcode='22023'; end if;
      select l.trip_id into trip from public.shared_ledger_links l where l.token_hash=shared_write.token_hash;
    end if;
    -- Every mutation, admission, and rotation serializes on the same book row.
    select * into t from public.shared_ledger_books where id=trip for update;
    if not found then raise exception '無法存取旅程，私人連結可能已失效' using errcode='42501'; end if;
    if p_action='open_book' then
      if not exists(select 1 from public.shared_ledger_links l where l.trip_id=trip and l.token_hash=shared_write.token_hash) then raise exception '私人連結已失效，請使用最新連結' using errcode='42501'; end if;
      insert into public.shared_ledger_devices(trip_id,user_id) values(trip,actor)
      on conflict(trip_id,user_id) do update set revoked_at=null,updated_at=now();
      result := jsonb_build_object('trip_id',trip,'version',t.version);
    else
      if not public.shared_ledger_has_access(trip) then raise exception '此裝置無法存取旅程，請使用最新私人連結' using errcode='42501'; end if;
      if p_action in ('rename_participants','rotate_link','set_rate') then
        if p_expected_version is null or t.version<>p_expected_version then raise exception '帳本設定已變更，請重新同步後確認' using errcode='40001'; end if;
        if p_action='rename_participants' then
          update public.shared_ledger_participants set name=case when slot=1 then first_name else second_name end where trip_id=trip;
        elsif p_action='rotate_link' then
          if exists(select 1 from public.shared_ledger_links l where l.trip_id=trip and l.token_hash=shared_write.token_hash) then raise exception '請產生全新的私人連結' using errcode='22023'; end if;
          update public.shared_ledger_links set token_hash=shared_write.token_hash,generation=generation+1,rotated_at=now() where trip_id=trip;
          update public.shared_ledger_devices set revoked_at=now(),updated_at=now() where trip_id=trip and user_id<>actor and revoked_at is null;
        else
          rate_text := p_payload->>'rate';
          if rate_text is null or rate_text !~ '^[0-9]{1,6}(\.[0-9]{1,8})?$' or rate_text::numeric<=0 then raise exception '匯率須大於 0，最多 6 位整數、8 位小數' using errcode='22023'; end if;
          update public.shared_ledger_books set exchange_rate=rate_text::numeric where id=trip;
        end if;
        update public.shared_ledger_books set version=version+1 where id=trip;
        result := jsonb_build_object('trip_id',trip,'version',t.version+1,'ok',true);
      elsif p_action in ('save_expense','delete_expense','save_settlement','delete_settlement') then
          select id into one_id from public.shared_ledger_participants where trip_id=trip and slot=1;
          select id into two_id from public.shared_ledger_participants where trip_id=trip and slot=2;
          if one_id is null or two_id is null then raise exception '帳本缺少兩位旅伴，請聯絡管理者' using errcode='22023'; end if;
          record_id := (p_payload->>'id')::uuid;
          if record_id is null then raise exception '缺少紀錄識別碼' using errcode='22023'; end if;
          if p_action in ('save_expense','delete_expense') then
            select * into e from public.shared_ledger_expenses where id=record_id and trip_id=trip;
            if found then
              if p_expected_version is null or e.version<>p_expected_version or e.deleted_at is not null then raise exception '此消費已被修改或刪除，請重新同步後再確認' using errcode='40001'; end if;
            elsif p_expected_version is not null or p_action='delete_expense' then raise exception '此消費已變更或無法存取' using errcode='40001'; end if;
          else
            select * into s from public.shared_ledger_settlements where id=record_id and trip_id=trip;
            if found then
              if p_expected_version is null or s.version<>p_expected_version or s.deleted_at is not null then raise exception '此結算已被修改或刪除，請重新同步後再確認' using errcode='40001'; end if;
            elsif p_expected_version is not null or p_action='delete_settlement' then raise exception '此結算已變更或無法存取' using errcode='40001'; end if;
          end if;
          if p_action='delete_expense' then
            update public.shared_ledger_expenses set deleted_at=now(),version=version+1,updated_by=actor,updated_at=now() where id=record_id and trip_id=trip;
          elsif p_action='delete_settlement' then
            update public.shared_ledger_settlements set deleted_at=now(),version=version+1,updated_by=actor,updated_at=now() where id=record_id and trip_id=trip;
          else
            amount := public.shared_ledger_yen(p_payload->>'amount_jpy');
            payer := (p_payload->>'payer_id')::uuid;
            if payer is null or payer not in (one_id,two_id) then raise exception '付款人必須是兩位旅伴之一' using errcode='22023'; end if;
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
                if receiver is null or receiver not in (one_id,two_id) then raise exception '負擔者必須是兩位旅伴之一' using errcode='22023'; end if;
                one_share := case when receiver=one_id then amount else 0 end; two_share := amount-one_share;
              elsif mode='custom' then
                if jsonb_typeof(p_payload->'shares') is distinct from 'object' or (select count(*) from jsonb_object_keys(p_payload->'shares'))<>2 then raise exception '自訂分攤須包含兩位旅伴' using errcode='22023'; end if;
                one_share := public.shared_ledger_yen(p_payload->'shares'->>one_id::text,true);
                two_share := public.shared_ledger_yen(p_payload->'shares'->>two_id::text,true);
                if one_share+two_share<>amount then raise exception '分攤合計必須等於消費金額' using errcode='22023'; end if;
              else raise exception '分攤方式不正確' using errcode='22023'; end if;
              if e.id is null then
                insert into public.shared_ledger_expenses(id,trip_id,title,amount_jpy,payer_id,member_one_id,member_two_id,share_one_jpy,share_two_jpy,split_mode,spent_on,category,notes,updated_by)
                values(record_id,trip,title,amount,payer,one_id,two_id,one_share,two_share,mode,event_date,p_payload->>'category',memo,actor);
              else
                update public.shared_ledger_expenses set title=shared_write.title,amount_jpy=amount,payer_id=payer,share_one_jpy=one_share,share_two_jpy=two_share,split_mode=mode,spent_on=event_date,category=p_payload->>'category',notes=memo,version=version+1,updated_by=actor,updated_at=now() where id=record_id and trip_id=trip;
              end if;
            else
              receiver := (p_payload->>'receiver_id')::uuid;
              if receiver is null or receiver not in (one_id,two_id) or receiver=payer then raise exception '結算雙方必須是不同旅伴' using errcode='22023'; end if;
              if s.id is null then
                insert into public.shared_ledger_settlements(id,trip_id,payer_id,receiver_id,amount_jpy,paid_on,notes,updated_by) values(record_id,trip,payer,receiver,amount,event_date,memo,actor);
              else
                update public.shared_ledger_settlements set payer_id=payer,receiver_id=receiver,amount_jpy=amount,paid_on=event_date,notes=memo,version=version+1,updated_by=actor,updated_at=now() where id=record_id and trip_id=trip;
              end if;
            end if;
          end if;
          result := jsonb_build_object('ok',true,'id',record_id);
      end if;
    end if;
  end if;
  insert into public.shared_ledger_requests(actor_id,request_id,trip_id,payload_hash,result) values(actor,p_request_id,trip,signature,result);
  return result;
end $$;
revoke all on function public.shared_ledger_command(uuid,text,uuid,integer,jsonb) from public, anon;
grant execute on function public.shared_ledger_command(uuid,text,uuid,integer,jsonb) to authenticated;

create function public.shared_ledger_snapshot(p_trip_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); selected uuid:=p_trip_id; output jsonb;
begin
  if actor is null then raise exception '背景裝置驗證尚未完成，請重新連線' using errcode='42501'; end if;
  if selected is null then select trip_id into selected from public.shared_ledger_devices where user_id=actor and revoked_at is null order by trip_id limit 1; end if;
  if selected is not null and not public.shared_ledger_has_access(selected) then raise exception '此裝置的旅程存取已撤銷，請使用最新私人連結' using errcode='42501'; end if;
  select jsonb_build_object(
    'schema_version',1,'profile',null,
    'trips',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'owner_id',t.owner_id,'rate',t.exchange_rate::text,'version',t.version) order by t.created_at) from public.shared_ledger_books t join public.shared_ledger_devices d on d.trip_id=t.id where d.user_id=actor and d.revoked_at is null),'[]'::jsonb),
    'trip',(select jsonb_build_object('id',id,'title',title,'owner_id',owner_id,'rate',exchange_rate::text,'version',version) from public.shared_ledger_books where id=selected),
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'slot',slot) order by slot) from public.shared_ledger_participants where trip_id=selected),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'trip_id',trip_id,'title',title,'amount_jpy',amount_jpy,'payer_id',payer_id,'date',to_char(spent_on,'YYYY-MM-DD'),'split_mode',split_mode,'shares',jsonb_build_object(member_one_id::text,share_one_jpy,member_two_id::text,share_two_jpy),'category',category,'notes',notes,'version',version) order by spent_on,updated_at) from public.shared_ledger_expenses where trip_id=selected and deleted_at is null),'[]'::jsonb),
    'settlements',coalesce((select jsonb_agg(jsonb_build_object('id',id,'trip_id',trip_id,'payer_id',payer_id,'receiver_id',receiver_id,'amount_jpy',amount_jpy,'date',to_char(paid_on,'YYYY-MM-DD'),'notes',notes,'version',version) order by paid_on,updated_at) from public.shared_ledger_settlements where trip_id=selected and deleted_at is null),'[]'::jsonb),
    'invites','[]'::jsonb
  ) into output;
  return output;
end $$;
revoke all on function public.shared_ledger_snapshot(uuid) from public, anon;
grant execute on function public.shared_ledger_snapshot(uuid) to authenticated;

-- Optional SQL-editor-only COPY. Never automatically imports, alters, or deletes legacy rows.
-- Call: select public.shared_ledger_copy_legacy('legacy-trip-uuid','new-64-lowercase-hex-token');
-- Existing copies return their ID unchanged: no duplicate imports or silent merge/overwrite.
create function public.shared_ledger_copy_legacy(p_legacy_trip_id uuid,p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t record; trip uuid; old_one uuid; old_two uuid; new_one uuid; new_two uuid;
begin
  if to_regclass('public.ledger_trips') is null or to_regclass('public.ledger_members') is null or to_regclass('public.ledger_profiles') is null or to_regclass('public.ledger_expenses') is null or to_regclass('public.ledger_settlements') is null then
    raise exception '沒有舊會員版帳本可複製；不需要執行舊 migration' using errcode='22023';
  end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception '須提供新的 256-bit 私人連結 token' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-copy:'||p_legacy_trip_id::text,0));
  select id into trip from public.shared_ledger_books where legacy_trip_id=p_legacy_trip_id;
  if found then return jsonb_build_object('trip_id',trip,'already_copied',true); end if;
  select * into t from public.ledger_trips where id=p_legacy_trip_id for update;
  if not found then raise exception '找不到舊帳本' using errcode='22023'; end if;
  select user_id into old_one from public.ledger_members where trip_id=p_legacy_trip_id and slot=1;
  select user_id into old_two from public.ledger_members where trip_id=p_legacy_trip_id and slot=2;
  if old_one is null or old_two is null then raise exception '舊帳本必須有兩位旅伴才可複製；原資料完全保留' using errcode='22023'; end if;
  insert into public.shared_ledger_books(title,owner_id,exchange_rate,legacy_trip_id) values(t.title,t.owner_id,t.exchange_rate,t.id) returning id into trip;
  insert into public.shared_ledger_participants(trip_id,slot,name) select trip,1,display_name from public.ledger_profiles where id=old_one returning id into new_one;
  insert into public.shared_ledger_participants(trip_id,slot,name) select trip,2,display_name from public.ledger_profiles where id=old_two returning id into new_two;
  insert into public.shared_ledger_links(trip_id,token_hash) values(trip,encode(sha256(convert_to(p_token,'UTF8')),'hex'));
  insert into public.shared_ledger_devices(trip_id,user_id) values(trip,old_one),(trip,old_two);
  insert into public.shared_ledger_expenses(id,trip_id,title,amount_jpy,payer_id,member_one_id,member_two_id,share_one_jpy,share_two_jpy,split_mode,spent_on,category,notes,version,updated_by,updated_at,deleted_at)
  select id,trip,title,amount_jpy,case when payer_id=old_one then new_one else new_two end,
    case when member_one_id=old_one then new_one else new_two end,case when member_two_id=old_one then new_one else new_two end,
    share_one_jpy,share_two_jpy,split_mode,spent_on,category,notes,version,updated_by,updated_at,deleted_at from public.ledger_expenses where trip_id=p_legacy_trip_id;
  insert into public.shared_ledger_settlements(id,trip_id,payer_id,receiver_id,amount_jpy,paid_on,notes,version,updated_by,updated_at,deleted_at)
  select id,trip,case when payer_id=old_one then new_one else new_two end,case when receiver_id=old_one then new_one else new_two end,
    amount_jpy,paid_on,notes,version,updated_by,updated_at,deleted_at from public.ledger_settlements where trip_id=p_legacy_trip_id;
  return jsonb_build_object('trip_id',trip,'already_copied',false);
end $$;
revoke all on function public.shared_ledger_copy_legacy(uuid,text) from public, anon, authenticated;

-- Safe live rows/tombstones only. Credentials, capability hashes, and request results never broadcast.
do $$
declare tab text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach tab in array array['shared_ledger_books','shared_ledger_participants','shared_ledger_devices','shared_ledger_expenses','shared_ledger_settlements'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tab) then
        execute format('alter publication supabase_realtime add table public.%I',tab);
      end if;
    end loop;
  end if;
end $$;
commit;
