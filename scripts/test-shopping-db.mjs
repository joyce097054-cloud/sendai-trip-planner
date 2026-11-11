import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const db=new PGlite(), users=[randomUUID(),randomUUID(),randomUUID()]
let passed=0
async function check(name,work){await work();console.log(`PASS ${++passed}: ${name}`)}
async function reject(work,code){await assert.rejects(work,e=>{assert.equal(e.code,code);return true})}
async function actor(id,role='authenticated'){await db.exec(`reset role;set role ${role};`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??''])}
async function ledger(action,trip,payload,version=null){return (await db.query('select public.shared_ledger_command($1,$2,$3,$4,$5) as r',[randomUUID(),action,trip,version,JSON.stringify(payload)])).rows[0].r}
async function command(trip,item,version=0,action='save',request=randomUUID()){return (await db.query('select public.shared_shopping_command($1,$2,$3,$4,$5) as r',[trip,request,action,version,JSON.stringify(item)])).rows[0].r}
async function snapshot(trip){return (await db.query('select public.shared_shopping_snapshot($1) as r',[trip])).rows[0].r.items}
const item=(id= randomUUID(),owner='lan')=>({id,name:'獨立 PostgreSQL 測試商品',quantity:2,shop:'測試店',notes:'不是真實購物紀錄',done:false,position:1000,owner_key:owner})
try {
  // Only the hosted Auth UID/roles are simulated. SQL, constraints and RLS use
  // the actual PostgreSQL engine. PGlite is single-connection, not a network or
  // multi-session race/Realtime test. Never connects to the user's Supabase.
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create publication supabase_realtime;")
  for(const id of users)await db.query('insert into auth.users values($1)',[id])
  await db.exec(await readFile(new URL('../supabase/migrations/202611050002_private_books.sql',import.meta.url),'utf8'))
  await actor(users[0]);const token='7'.repeat(64),book=(await ledger('create_book',null,{title:'隔離測試帳本',names:['測試藍','測試條約'],token})).trip_id
  let old=JSON.stringify((await db.query('select public.shared_ledger_snapshot($1) as r',[book])).rows[0].r)
  await actor(users[0]);const other=(await ledger('create_book',null,{title:'第二本隔離帳本',names:['測試一','測試二'],token:'8'.repeat(64)})).trip_id
  old=JSON.stringify((await db.query('select public.shared_ledger_snapshot($1) as r',[book])).rows[0].r)
  await db.exec('reset role')
  await check('003 新增後原帳務快照不變',async()=>{await db.exec(await readFile(new URL('../supabase/migrations/202611100003_shopping_lists.sql',import.meta.url),'utf8'));await actor(users[0]);assert.equal(JSON.stringify((await db.query('select public.shared_ledger_snapshot($1) as r',[book])).rows[0].r),old)})
  await check('匿名未驗證不能呼叫，非旅程裝置不能查詢或寫入',async()=>{await actor(null,'anon');await reject(snapshot(book),'42501');await actor(users[2]);assert.equal((await db.query('select * from public.shared_shopping_items')).rows.length,0);await reject(snapshot(book),'42501');await reject(command(book,item()),'42501')})
  const first=item('first'),second=item('second','treaty')
  await check('藍與條約各自商品保存，兩個不同新增不互相覆蓋',async()=>{await actor(users[0]);await command(book,first);await command(book,second);const rows=await snapshot(book);assert.equal(rows.length,2);assert.equal(rows.filter(i=>i.owner_key==='lan').length,1);assert.equal(rows.filter(i=>i.owner_key==='treaty').length,1)})
  await check('朋友用私人連結取得既有權限，新裝置讀到相同清單',async()=>{await actor(users[1]);await ledger('open_book',null,{token});assert.equal((await snapshot(book)).length,2);await command(book,item('from-friend'));await actor(users[0]);assert((await snapshot(book)).some(i=>i.id==='from-friend'))})
  await check('成員無法直接寫表或讀取冪等請求表',async()=>{await reject(db.query("update public.shared_shopping_items set name='bypass'"),'42501');await reject(db.query('select * from public.shared_shopping_requests'),'42501')})
  await check('相同冪等 ID 重送只建立一筆，修改內容重用 ID 被拒絕',async()=>{const payload=item('idempotent'),id=randomUUID();const a=await command(book,payload,0,'save',id),b=await command(book,payload,0,'save',id);assert.deepEqual(a,b);assert.equal((await snapshot(book)).filter(i=>i.id===payload.id).length,1);await reject(command(book,{...payload,name:'changed'},0,'save',id),'22023')})
  await check('同筆舊版本編輯及刪除均被拒絕，修改者資料保留',async()=>{await actor(users[1]);await command(book,{...first,name:'朋友先修改'},1);await actor(users[0]);await reject(command(book,{...first,name:'舊表單'},1),'40001');await reject(command(book,first,1,'delete'),'40001');assert.equal((await snapshot(book)).find(i=>i.id==='first').name,'朋友先修改')})
  await check('不合法名稱、數量、主人、位置與版本不寫入',async()=>{for(const [patch,code] of [[{name:''},'23514'],[{quantity:1.5},'22023'],[{quantity:0},'23514'],[{owner_key:'other'},'22023'],[{position:1000000000},'23514']])await reject(command(book,{...item(),...patch}),code);await reject(command(book,item(),-1),'22023')})
  await check('數量待定、勾選、排序及備註可保存，修改不影響另一人',async()=>{await command(book,{...second,quantity:null,position:500,done:true,notes:'保留註記'},1);const rows=await snapshot(book);assert.equal(rows[0].id,'second');assert.equal(rows[0].quantity,null);assert.equal(rows[0].done,true);assert.equal(rows.find(i=>i.id==='first').name,'朋友先修改')})
  await check('其他帳本 ID 不能越權，改主人名稱不能取得權限',async()=>{await actor(users[1]);await reject(snapshot(other),'42501');await reject(command(other,item('other-book','treaty')),'42501');assert.equal((await db.query('select * from public.shared_shopping_items where trip_id=$1',[other])).rows.length,0)})
  await check('刪除為 tombstone，不能以舊表單或新增偷偷復活',async()=>{await actor(users[0]);await command(book,first,2,'delete');assert(!(await snapshot(book)).some(i=>i.id==='first'));await reject(command(book,first,0),'40001');await reject(command(book,first,3),'40001')})
  await check('連結輪替後既有裝置、快取重送均失權',async()=>{const payload=item('rotate-replay'),request=randomUUID();await actor(users[1]);await command(book,payload,0,'save',request);await actor(users[0]);await ledger('rotate_link',book,{token:'9'.repeat(64)},1);await actor(users[1]);await reject(snapshot(book),'42501');await reject(command(book,payload,0,'save',request),'42501');assert.equal((await db.query('select * from public.shared_shopping_items')).rows.length,0)})
  await check('只發布 shopping items，請求表不進 Realtime',async()=>{await db.exec('reset role');const tables=(await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows.map(r=>r.tablename);assert(tables.includes('shared_shopping_items'));assert(!tables.includes('shared_shopping_requests'))})
  await check('唯讀安裝確認固定回傳五列且全部就緒',async()=>{const result=await db.query(await readFile(new URL('../supabase/checks/20261110_shopping_setup.sql',import.meta.url),'utf8'));assert.equal(result.rows.length,5);assert(result.rows.every(r=>r.ready===true))})
  console.log(`${passed} embedded PostgreSQL checks passed. Hosted Auth/Realtime and multi-session concurrency remain separate acceptance tests.`)
}finally{await db.close()}
