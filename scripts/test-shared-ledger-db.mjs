import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { randomUUID, randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
const admin = new pg.Client({ host:'127.0.0.1', port:55432, user:'postgres', database:'postgres' })
const database = `sendai_private_test_${randomBytes(6).toString('hex')}`
let owner
let passed = 0
const clients = []
async function check(name, work) { await work(); passed++; console.log(`PASS ${name}`) }
async function reject(promise, code) { await assert.rejects(promise, error => { assert.equal(error.code, code); return true }) }
async function actor(id) {
  const c = new pg.Client({ host:'127.0.0.1', port:55432, user:'postgres', database }); await c.connect(); clients.push(c)
  await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); return c
}
async function command(c, action, trip, payload={}, version=null, request=randomUUID()) {
  return (await c.query('select public.shared_ledger_command($1,$2,$3,$4,$5) as result',[request,action,trip,version,payload])).rows[0].result
}
const snapshot = async (c,trip=null) => (await c.query('select public.shared_ledger_snapshot($1) as result',[trip])).rows[0].result
try {
  await admin.connect(); await admin.query(`create database ${database}`)
  owner = new pg.Client({host:'127.0.0.1',port:55432,user:'postgres',database}); await owner.connect()
  // This harness stubs only Auth's UID/roles. Real PostgreSQL enforces RLS and
  // concurrent transactions; hosted anonymous Auth and Realtime delivery need separate verification.
  await owner.query(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create publication supabase_realtime;`)
  await check('全新專案只跑 002 即可，不需要建立 Email 會員表',async()=>{
    const freshName=database+'_fresh'
    await admin.query(`create database ${freshName}`)
    const fresh=new pg.Client({host:'127.0.0.1',port:55432,user:'postgres',database:freshName})
    try{
      await fresh.connect()
      await fresh.query(`create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`)
      await fresh.query(await readFile(new URL('../supabase/migrations/202611050002_private_books.sql',import.meta.url),'utf8'))
      assert.equal((await fresh.query("select to_regclass('public.ledger_profiles') as table_name")).rows[0].table_name,null)
      await reject(fresh.query('select public.shared_ledger_copy_legacy($1,$2)',[randomUUID(),randomBytes(32).toString('hex')]),'22023')
    }finally{await fresh.end();await admin.query(`drop database if exists ${freshName} with (force)`)}
  })
  await owner.query(await readFile(new URL('../supabase/migrations/202611050001_ledger.sql',import.meta.url),'utf8'))
  const ids=Array.from({length:6},()=>randomUUID())
  for(const id of ids) await owner.query('insert into auth.users values($1)',[id])
  const [a,b,third,outsider]=await Promise.all(ids.slice(0,4).map(actor))
  // Seed a complete previous-generation book before applying the additive upgrade.
  const legacyTrip=randomUUID(),legacyExpense=randomUUID(),legacySettlement=randomUUID()
  await owner.query(`insert into public.ledger_profiles(id,display_name) values($1,'舊旅伴甲'),($2,'舊旅伴乙');
  `,[ids[4],ids[5]])
  await owner.query('insert into public.ledger_trips(id,title,owner_id,exchange_rate) values($1,$2,$3,0.22)',[legacyTrip,'舊旅程',ids[4]])
  await owner.query('insert into public.ledger_members(trip_id,user_id,slot) values($1,$2,1),($1,$3,2)',[legacyTrip,ids[4],ids[5]])
  await owner.query(`insert into public.ledger_expenses(id,trip_id,title,amount_jpy,payer_id,member_one_id,member_two_id,share_one_jpy,share_two_jpy,split_mode,spent_on,category,updated_by)
    values($1,$2,'保留舊消費',101,$3,$3,$4,51,50,'equal','2026-11-20','餐飲',$3)`,[legacyExpense,legacyTrip,ids[4],ids[5]])
  await owner.query(`insert into public.ledger_settlements(id,trip_id,payer_id,receiver_id,amount_jpy,paid_on,updated_by) values($1,$2,$3,$4,20,'2026-11-21',$3)`,[legacySettlement,legacyTrip,ids[5],ids[4]])
  const legacyState=async()=> (await owner.query(`select jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(t) order by id) from public.ledger_profiles t),'trips',(select jsonb_agg(to_jsonb(t) order by id) from public.ledger_trips t),'members',(select jsonb_agg(to_jsonb(t) order by user_id) from public.ledger_members t),'expenses',(select jsonb_agg(to_jsonb(t) order by id) from public.ledger_expenses t),'settlements',(select jsonb_agg(to_jsonb(t) order by id) from public.ledger_settlements t)) as result`)).rows[0].result
  const beforeLegacy=await legacyState()
  await owner.query(await readFile(new URL('../supabase/migrations/202611050002_private_books.sql',import.meta.url),'utf8'))
  await check('升級保留舊資料與 API，不自動搬移或覆寫',async()=>{
    assert.deepEqual(await legacyState(),beforeLegacy)
    assert.equal((await owner.query('select * from public.shared_ledger_books')).rowCount,0)
    assert((await owner.query("select to_regprocedure('public.ledger_command(uuid,text,uuid,integer,jsonb)') as fn")).rows[0].fn)
  })
  let token=randomBytes(32).toString('hex')
  const createRequest=randomUUID()
  const createPayload={title:'測試私人旅程',names:['小林','小雨'],token}
  const trip=(await command(a,'create_book',null,createPayload,null,createRequest)).trip_id
  await check('不建立會員，兩位帳務參與者與背景裝置身分分離',async()=>{
    const snap=await snapshot(a,trip)
    assert.equal(snap.profile,null);assert.equal(snap.members.length,2);assert.deepEqual(snap.members.map(m=>m.name),['小林','小雨'])
    assert(snap.members.every(m=>!ids.includes(m.id)))
    assert.deepEqual(await command(a,'create_book',null,createPayload,null,createRequest),{trip_id:trip,version:1})
    assert.equal((await owner.query('select * from public.ledger_profiles')).rowCount,2)
  })
  await check('非持連結裝置與 raw anon 無權讀寫，直接 DML 一律拒絕',async()=>{
    await reject(snapshot(outsider,trip),'42501')
    for(const table of ['shared_ledger_books','shared_ledger_participants','shared_ledger_expenses','shared_ledger_settlements','shared_ledger_devices']) assert.equal((await outsider.query(`select * from public.${table}`)).rowCount,0)
    await reject(outsider.query('select * from public.shared_ledger_links'),'42501')
    await reject(outsider.query('select * from public.shared_ledger_requests'),'42501')
    await reject(a.query('update public.shared_ledger_books set title=$1 where id=$2',['bypass',trip]),'42501')
    await reject(a.query('insert into public.shared_ledger_devices(trip_id,user_id) values($1,$2)',[trip,ids[3]]),'42501')
    const anon=new pg.Client({host:'127.0.0.1',port:55432,user:'postgres',database}); await anon.connect();clients.push(anon)
    await anon.query('set role anon')
    await reject(snapshot(anon,trip),'42501')
    await reject(command(anon,'open_book',null,{token}),'42501')
    await reject(anon.query('select * from public.shared_ledger_expenses'),'42501')
  })
  const openRequest=randomUUID()
  await check('同一私人連結可重複使用，超過兩部裝置仍只有兩位帳務參與者',async()=>{
    await Promise.all([command(b,'open_book',null,{token},null,openRequest),command(third,'open_book',null,{token})])
    const fourth=await actor(ids[4]);await command(fourth,'open_book',null,{token})
    assert.equal((await snapshot(third,trip)).members.length,2)
    assert.equal((await owner.query('select * from public.shared_ledger_devices where trip_id=$1',[trip])).rowCount,4)
    await reject(command(outsider,'open_book',null,{token:randomBytes(32).toString('hex')}),'42501')
  })
  await check('僅保存能力雜湊，敏感資料不加入 Realtime',async()=>{
    const row=(await owner.query('select * from public.shared_ledger_links where trip_id=$1',[trip])).rows[0]
    assert.notEqual(row.token_hash,token);assert(!JSON.stringify(row).includes(token))
    const requests=(await owner.query('select * from public.shared_ledger_requests')).rows
    assert(!JSON.stringify(requests).includes(token))
    const tables=(await owner.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows.map(t=>t.tablename)
    assert(tables.includes('shared_ledger_expenses'));assert(tables.includes('shared_ledger_devices'))
    assert(!tables.includes('shared_ledger_links'));assert(!tables.includes('shared_ledger_requests'))
  })
  const members=(await snapshot(a,trip)).members
  const payerId=members[0].id,partnerId=members[1].id,partner=b,nonMember=outsider
  const expense={id:randomUUID(),title:'奇數日圓測試',amount_jpy:101,payer_id:payerId,date:'2026-11-20',split_mode:'equal',category:'餐飲',notes:''}
  await check('奇數日圓由付款人負擔，多出一圓與成員順序無關',async()=>{
    await command(a,'save_expense',trip,expense)
    let e=(await snapshot(partner,trip)).expenses[0]
    assert.equal(e.shares[payerId],51); assert.equal(e.shares[partnerId],50)
    await command(partner,'save_expense',trip,{...expense,payer_id:partnerId},e.version)
    e=(await snapshot(a,trip)).expenses[0]; assert.equal(e.shares[partnerId],51); assert.equal(e.shares[payerId],50)
  })
  await check('自訂金額不平衡、非成員付款與非法日期不寫入',async()=>{
    await reject(command(a,'save_expense',trip,{...expense,id:randomUUID(),split_mode:'custom',shares:{[payerId]:100,[partnerId]:0}}),'22023')
    await reject(command(a,'save_expense',trip,{...expense,id:randomUUID(),payer_id:ids[3]}),'22023')
    await reject(command(a,'save_expense',trip,{...expense,id:randomUUID(),date:'2026-02-30'}),'22008')
    await reject(command(nonMember,'save_expense',trip,expense),'42501')
  })
  await check('單人全額與自訂分攤寫入後由另一成員讀到',async()=>{
    const single={...expense,id:randomUUID(),split_mode:'single',single_member_id:partnerId}
    await command(a,'save_expense',trip,single)
    const custom={...expense,id:randomUUID(),split_mode:'custom',shares:{[payerId]:30,[partnerId]:71}}
    await command(a,'save_expense',trip,custom)
    const rows=(await snapshot(partner,trip)).expenses
    assert.equal(rows.find(e=>e.id===single.id).shares[payerId],0)
    assert.equal(rows.find(e=>e.id===custom.id).shares[partnerId],71)
  })
  await check('冪等 ID 防止並行重送與內容竄改',async()=>{
    const id=randomUUID(), payload={...expense,id:randomUUID()}
    const sameActor=await actor(ids[0])
    const result=await Promise.all([command(a,'save_expense',trip,payload,null,id),command(sameActor,'save_expense',trip,payload,null,id)])
    assert.deepEqual(result[0],result[1]); assert.equal((await owner.query('select * from public.shared_ledger_expenses where id=$1',[payload.id])).rowCount,1)
    await reject(command(a,'save_expense',trip,{...payload,title:'changed'},null,id),'22023')
  })
  await check('同時修改只有一人成功，過期版本的刪除也會被拒絕',async()=>{
    const e=(await snapshot(a,trip)).expenses.find(e=>e.id===expense.id)
    const outcomes=await Promise.allSettled([command(a,'save_expense',trip,{...expense,title:'版本甲'},e.version),command(partner,'save_expense',trip,{...expense,title:'版本乙'},e.version)])
    assert.equal(outcomes.filter(v=>v.status==='fulfilled').length,1)
    const failure=outcomes.find(v=>v.status==='rejected'); assert.equal(failure.reason.code,'40001')
    await reject(command(a,'delete_expense',trip,{id:expense.id},e.version),'40001')
    const fresh=(await snapshot(a,trip)).expenses.find(e=>e.id===expense.id)
    await command(partner,'delete_expense',trip,{id:expense.id},fresh.version)
    assert(!(await snapshot(a,trip)).expenses.some(e=>e.id===expense.id))
    await reject(command(a,'save_expense',trip,expense,fresh.version+1),'40001')
  })
  await check('匯率為 numeric 並以字串回傳，過期版本不能覆寫',async()=>{
    const version=(await snapshot(a,trip)).trip.version
    await command(a,'set_rate',trip,{rate:'0.21345678'},version)
    assert.equal((await snapshot(partner,trip)).trip.rate,'0.21345678')
    await reject(command(partner,'set_rate',trip,{rate:'0.2'},version),'40001')
    await reject(command(a,'set_rate',trip,{rate:'0.123456789'},version+1),'22023')
  })
  await check('部分結算保留原始消費，更新與刪除亦受版本保護',async()=>{
    const payload={id:randomUUID(),payer_id:partnerId,receiver_id:payerId,amount_jpy:20,date:'2026-11-21',notes:'部分轉帳'}
    const before=(await snapshot(a,trip)).expenses.length
    await command(partner,'save_settlement',trip,payload)
    let s=(await snapshot(a,trip)).settlements[0]; assert.equal(s.amount_jpy,20)
    await command(a,'save_settlement',trip,{...payload,amount_jpy:25},s.version)
    await reject(command(partner,'delete_settlement',trip,{id:payload.id},s.version),'40001')
    s=(await snapshot(a,trip)).settlements[0]
    await command(partner,'delete_settlement',trip,{id:payload.id},s.version)
    const snap=await snapshot(a,trip); assert.equal(snap.settlements.length,0); assert.equal(snap.expenses.length,before)
    await reject(command(a,'save_settlement',trip,{...payload,id:randomUUID(),receiver_id:partnerId}),'22023')
  })
  await check('兩支手機同時新增不同消費，兩筆皆保留且重連能取得',async()=>{
    const payloads=[{...expense,id:randomUUID(),title:'同時新增甲'},{...expense,id:randomUUID(),title:'同時新增乙'}]
    await Promise.all(payloads.map((p,i)=>command(i?a:b,'save_expense',trip,p)))
    const reconnected=await actor(ids[1]);const rows=(await snapshot(reconnected,trip)).expenses
    for(const p of payloads)assert(rows.some(e=>e.id===p.id))
  })
  await check('名稱修改不改參與者 UUID，舊版本設定被拒絕',async()=>{
    const version=(await snapshot(a,trip)).trip.version
    await command(third,'rename_participants',trip,{names:['旅伴一','旅伴二']},version)
    const snap=await snapshot(b,trip)
    assert.deepEqual(snap.members.map(m=>m.id),[payerId,partnerId]);assert.deepEqual(snap.members.map(m=>m.name),['旅伴一','旅伴二'])
    await reject(command(a,'rename_participants',trip,{names:['覆蓋一','覆蓋二']},version),'40001')
    await reject(command(a,'rename_participants',trip,{names:['相同','相同']},snap.trip.version),'22023')
  })
  await check('輪替連結撤銷其他裝置，舊連結與快取重送不能恢復存取',async()=>{
    const oldToken=token,newToken=randomBytes(32).toString('hex'),version=(await snapshot(a,trip)).trip.version
    await command(a,'rotate_link',trip,{token:newToken},version)
    await reject(snapshot(b,trip),'42501');await reject(snapshot(third,trip),'42501')
    assert.equal((await b.query('select * from public.shared_ledger_expenses')).rowCount,0)
    assert.equal((await b.query('select * from public.shared_ledger_devices where revoked_at is not null')).rowCount,1)
    await reject(command(b,'open_book',null,{token:oldToken},null,openRequest),'42501')
    await reject(command(outsider,'open_book',null,{token:oldToken}),'42501')
    await command(b,'open_book',null,{token:newToken})
    assert.equal((await snapshot(b,trip)).members.length,2)
    await reject(command(b,'open_book',null,{token:oldToken},null,openRequest),'42501')
    assert.equal((await snapshot(a,trip)).trip.version,version+1)
    token=newToken
  })
  await check('非持連結裝置不能猜 ID 修改、刪除或讀取帳務',async()=>{
    const e=(await snapshot(a,trip)).expenses[0]
    await reject(command(nonMember,'delete_expense',trip,{id:e.id},e.version),'42501')
    await reject(snapshot(nonMember,trip),'42501')
    assert.equal((await nonMember.query('select * from public.shared_ledger_expenses')).rowCount,0)
  })
  await check('管理員可選擇複製舊帳本且只能複製一次，不修改任何舊資料',async()=>{
    const copyToken=randomBytes(32).toString('hex')
    await reject(a.query('select public.shared_ledger_copy_legacy($1,$2)',[legacyTrip,copyToken]),'42501')
    const copied=(await owner.query('select public.shared_ledger_copy_legacy($1,$2) as result',[legacyTrip,copyToken])).rows[0].result
    assert.equal(copied.already_copied,false)
    const again=(await owner.query('select public.shared_ledger_copy_legacy($1,$2) as result',[legacyTrip,copyToken])).rows[0].result
    assert.equal(again.trip_id,copied.trip_id);assert.equal(again.already_copied,true)
    await command(third,'open_book',null,{token:copyToken})
    const snap=await snapshot(third,copied.trip_id)
    assert.deepEqual(snap.members.map(m=>m.name),['舊旅伴甲','舊旅伴乙']);assert.equal(snap.trip.rate,'0.22000000')
    assert.equal(snap.expenses[0].id,legacyExpense);assert.equal(snap.expenses[0].amount_jpy,101)
    assert.equal(snap.expenses[0].shares[snap.members[0].id],51);assert.equal(snap.settlements[0].amount_jpy,20)
    assert.deepEqual(await legacyState(),beforeLegacy)
  })
  await check('刪除匿名裝置身分不會刪除帳本，新的手機仍能用私人連結恢復',async()=>{
    const before=await snapshot(a,trip)
    await owner.query('delete from auth.users where id=$1',[ids[0]])
    await reject(snapshot(a,trip),'42501')
    const recoveredId=randomUUID();await owner.query('insert into auth.users values($1)',[recoveredId])
    const recovered=await actor(recoveredId);await command(recovered,'open_book',null,{token})
    const after=await snapshot(recovered,trip)
    assert.equal(after.trip.owner_id,null)
    assert.deepEqual(after.members,before.members)
    assert.deepEqual(after.expenses,before.expenses)
    assert.deepEqual(after.settlements,before.settlements)
  })
  console.log(`\n${passed} PostgreSQL private-ledger security/concurrency checks passed. Hosted anonymous Auth, two-device Realtime delivery, and iPhone behavior still require verification.`)
} finally {
  await Promise.all(clients.map(c=>c.end().catch(()=>{})))
  if(owner) await owner.end().catch(()=>{})
  if(!admin.ended) { await admin.query(`drop database if exists ${database} with (force)`).catch(()=>{}); await admin.end().catch(()=>{}) }
}
