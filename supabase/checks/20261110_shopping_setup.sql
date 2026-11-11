-- Read-only installation check. Expect 5 rows, each ready = true.
-- This checks installation only, not real-device Auth / Realtime behavior.
select 'shared_shopping_items：資料表及 RLS' as item,
       exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
              where n.nspname='public' and c.relname='shared_shopping_items' and c.relkind='r' and c.relrowsecurity) as ready
union all
select 'shared_shopping_requests：資料表及 RLS',
       exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
              where n.nspname='public' and c.relname='shared_shopping_requests' and c.relkind='r' and c.relrowsecurity)
union all
select 'shared_shopping_snapshot：函式', to_regprocedure('public.shared_shopping_snapshot(uuid)') is not null
union all
select 'shared_shopping_command：函式', to_regprocedure('public.shared_shopping_command(uuid,uuid,text,integer,jsonb)') is not null
union all
select 'shared_shopping_items：Realtime',
       exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shared_shopping_items');
