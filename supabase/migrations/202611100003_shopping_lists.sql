-- Additive shopping module. Run AFTER 002, once, in a single transaction.
-- Does not change existing ledger tables, balances, participants, links or RPCs.
begin;

create table public.shared_shopping_items (
  trip_id uuid not null references public.shared_ledger_books(id),
  owner_key text not null check(owner_key in ('lan','treaty')),
  id text not null check(char_length(id) between 1 and 200),
  name text not null check(char_length(btrim(name)) between 1 and 200),
  quantity integer check(quantity between 1 and 999),
  shop text not null default '' check(char_length(shop)<=300),
  notes text not null default '' check(char_length(notes)<=5000),
  done boolean not null default false,
  position numeric not null check(position > -1000000000 and position < 1000000000),
  version integer not null default 1 check(version>0),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(trip_id,owner_key,id)
);
create table public.shared_shopping_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  trip_id uuid not null references public.shared_ledger_books(id),
  signature bytea not null,
  result jsonb not null,
  primary key(user_id,request_id)
);
alter table public.shared_shopping_items enable row level security;
alter table public.shared_shopping_requests enable row level security;
revoke all on public.shared_shopping_items,public.shared_shopping_requests from public,anon,authenticated;
grant select on public.shared_shopping_items to authenticated;
create policy shopping_read_authorized_device on public.shared_shopping_items for select to authenticated
  using(public.shared_ledger_has_access(trip_id));

create function public.shared_shopping_snapshot(p_trip_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.shared_ledger_has_access(p_trip_id) then
    raise exception 'No access to shopping book' using errcode='42501';
  end if;
  return jsonb_build_object('items',coalesce((
    select jsonb_agg(to_jsonb(i) order by i.position,i.id)
    from public.shared_shopping_items i where i.trip_id=p_trip_id and not i.deleted
  ),'[]'::jsonb));
end $$;

create function public.shared_shopping_command(p_trip_id uuid,p_request_id uuid,p_action text,p_expected_version integer,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  who uuid := auth.uid();
  signature bytea;
  previous public.shared_shopping_requests%rowtype;
  current_item public.shared_shopping_items%rowtype;
  result jsonb;
  owner_name text := p_payload->>'owner_key';
  item_id text := p_payload->>'id';
begin
  -- Ownership names are labels; device membership is the authorization boundary.
  if who is null or not public.shared_ledger_has_access(p_trip_id) then
    raise exception 'No access to shopping book' using errcode='42501';
  end if;
  if p_request_id is null or p_action is null or p_action not in ('save','delete') or p_expected_version is null or p_expected_version<0
    or jsonb_typeof(p_payload) is distinct from 'object' or owner_name is null or owner_name not in ('lan','treaty')
    or item_id is null or char_length(item_id) not between 1 and 200 then
    raise exception 'Invalid shopping request' using errcode='22023';
  end if;
  signature := sha256(convert_to(jsonb_build_array(p_trip_id,p_action,p_expected_version,p_payload)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended(who::text||p_request_id::text,0));
  select * into previous from public.shared_shopping_requests r where r.user_id=who and r.request_id=p_request_id;
  if found then
    if previous.signature<>signature then raise exception 'Request ID reused with different payload' using errcode='22023'; end if;
    return previous.result;
  end if;
  -- Serialize edits per record; different inserts remain independent.
  perform pg_advisory_xact_lock(hashtextextended(p_trip_id::text||owner_name||item_id,1));
  select * into current_item from public.shared_shopping_items i where i.trip_id=p_trip_id and i.owner_key=owner_name and i.id=item_id for update;
  if (not found and p_expected_version<>0) or (current_item.id is not null and (current_item.version<>p_expected_version or current_item.deleted)) or (p_action='delete' and current_item.id is null) then
    raise exception 'Shopping record changed' using errcode='40001';
  end if;
  if p_action='delete' then
    update public.shared_shopping_items i set deleted=true,version=i.version+1,updated_at=now()
    where i.trip_id=p_trip_id and i.owner_key=owner_name and i.id=item_id returning * into current_item;
  else
    if jsonb_typeof(p_payload->'name') is distinct from 'string' or jsonb_typeof(p_payload->'shop') is distinct from 'string'
      or jsonb_typeof(p_payload->'notes') is distinct from 'string' or jsonb_typeof(p_payload->'done') is distinct from 'boolean'
      or jsonb_typeof(p_payload->'position') is distinct from 'number'
      or (jsonb_typeof(p_payload->'quantity') is distinct from 'number' and jsonb_typeof(p_payload->'quantity') is distinct from 'null')
      or (jsonb_typeof(p_payload->'quantity')='number' and (p_payload->>'quantity')!~'^[0-9]+$') then
      raise exception 'Invalid shopping fields' using errcode='22023';
    end if;
    if current_item.id is null then
      insert into public.shared_shopping_items(trip_id,owner_key,id,name,quantity,shop,notes,done,position)
      values(p_trip_id,owner_name,item_id,btrim(p_payload->>'name'),(p_payload->>'quantity')::integer,p_payload->>'shop',p_payload->>'notes',(p_payload->>'done')::boolean,(p_payload->>'position')::numeric)
      returning * into current_item;
    else
      update public.shared_shopping_items i set name=btrim(p_payload->>'name'),quantity=(p_payload->>'quantity')::integer,shop=p_payload->>'shop',notes=p_payload->>'notes',done=(p_payload->>'done')::boolean,position=(p_payload->>'position')::numeric,version=i.version+1,updated_at=now()
      where i.trip_id=p_trip_id and i.owner_key=owner_name and i.id=item_id returning * into current_item;
    end if;
  end if;
  result := jsonb_build_object('id',current_item.id,'version',current_item.version);
  insert into public.shared_shopping_requests(user_id,request_id,trip_id,signature,result) values(who,p_request_id,p_trip_id,signature,result);
  return result;
end $$;
revoke all on function public.shared_shopping_snapshot(uuid),public.shared_shopping_command(uuid,uuid,text,integer,jsonb) from public,anon;
grant execute on function public.shared_shopping_snapshot(uuid),public.shared_shopping_command(uuid,uuid,text,integer,jsonb) to authenticated;

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shared_shopping_items') then
   alter publication supabase_realtime add table public.shared_shopping_items;
 end if;
end $$;
commit;
