import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { randomUUID, randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
const admin = new pg.Client({ host:'127.0.0.1', port:55432, user:'postgres', database:'postgres' })
const database = `sendai_test_${randomBytes(6).toString('hex')}`
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
  return (await c.query('select public.ledger_command($1,$2,$3,$4,$5) as result',[request,action,trip,version,payload])).rows[0].result
}
const snapshot = async (c,trip=null) => (await c.query('select public.ledger_snapshot($1) as result',[trip])).rows[0].result
try {
  await admin.connect(); await admin.query(`create database ${database}`)
  owner = new pg.Client({host:'127.0.0.1',port:55432,user:'postgres',database}); await owner.connect()
  // Supabase Auth is NOT emulated as a completed product feature. This harness
  // supplies only auth.uid() and roles to exercise real PostgreSQL/RLS/RPC logic.
  await owner.query(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`)
  await owner.query(await readFile(new URL('../supabase/migrations/202611050001_ledger.sql',import.meta.url),'utf8'))
  const ids=[randomUUID(),randomUUID(),randomUUID(),randomUUID()]
  for(const id of ids) await owner.query('insert into auth.users values($1)',[id])
  const [a,b,outsider,fourth]=await Promise.all(ids.map(actor))
  for(const [index,c] of [a,b,outsider,fourth].entries()) await command(c,'profile',null,{name:['小林','小雨','非成員','另一位'][index]})
  const trip=(await command(a,'create_trip',null,{title:'測試專用旅程'})).trip_id
  await check('非成員不能讀取快照，RLS 不洩露旅程、成員或姓名',async()=>{
    await reject(snapshot(outsider,trip),'42501')
    for(const table of ['ledger_trips','ledger_members','ledger_expenses','ledger_settlements']) assert.equal((await outsider.query(`select * from public.${table}`)).rowCount,0)
    assert.equal((await outsider.query('select * from public.ledger_profiles')).rowCount,1)
    await reject(outsider.query('select * from public.ledger_invites'),'42501')
    await reject(outsider.query('select * from public.ledger_requests'),'42501')
  })
  await check('不能直接插入或繞過 RPC 寫入帳務',async()=>{
    await reject(a.query('insert into public.ledger_members(trip_id,user_id,slot) values($1,$2,2)',[trip,ids[2]]),'42501')
    await reject(a.query('update public.ledger_trips set title=$1 where id=$2',['bypass',trip]),'42501')
  })
  await check('單人旅程不建立假旅伴，不能新增雙人帳務',async()=>{
    assert.equal((await snapshot(a,trip)).members.length,1)
    await reject(command(a,'save_expense',trip,{id:randomUUID()}),'22023')
  })
  let token=randomBytes(32).toString('hex')
  await command(a,'create_invite',trip,{token})
  await check('邀請雜湊儲存，過期與撤銷皆不可使用',async()=>{
    const row=(await owner.query('select * from public.ledger_invites where trip_id=$1',[trip])).rows[0]
    assert.notEqual(row.token_hash,token); assert(!JSON.stringify(row).includes(token))
    await owner.query("update public.ledger_invites set expires_at=now()-interval '1 second' where trip_id=$1",[trip])
    await reject(command(b,'join_trip',null,{token}),'22023')
    token=randomBytes(32).toString('hex'); const invite=await command(a,'create_invite',trip,{token})
    await command(a,'revoke_invite',trip,{id:invite.invite_id}); await reject(command(b,'join_trip',null,{token}),'22023')
  })
  token=randomBytes(32).toString('hex'); await command(a,'create_invite',trip,{token})
  await check('同時兌換只允許一人加入，第三人無法擠入',async()=>{
    const outcomes=await Promise.allSettled([command(b,'join_trip',null,{token}),command(outsider,'join_trip',null,{token})])
    assert.equal(outcomes.filter(v=>v.status==='fulfilled').length,1)
    assert.equal((await owner.query('select * from public.ledger_members where trip_id=$1',[trip])).rowCount,2)
    await reject(command(fourth,'join_trip',null,{token}),'22023')
  })
  const members=(await snapshot(a,trip)).members
  const partnerId=members.find(m=>m.id!==ids[0]).id
  const partner=partnerId===ids[1]?b:outsider
  const nonMember=partner===b?outsider:b
  const expense={id:randomUUID(),title:'奇數日圓測試',amount_jpy:101,payer_id:ids[0],date:'2026-11-20',split_mode:'equal',category:'餐飲',notes:''}
  await check('奇數日圓由付款人負擔，多出一圓與成員順序無關',async()=>{
    await command(a,'save_expense',trip,expense)
    let e=(await snapshot(partner,trip)).expenses[0]
    assert.equal(e.shares[ids[0]],51); assert.equal(e.shares[partnerId],50)
    await command(partner,'save_expense',trip,{...expense,payer_id:partnerId},e.version)
    e=(await snapshot(a,trip)).expenses[0]; assert.equal(e.shares[partnerId],51); assert.equal(e.shares[ids[0]],50)
  })
  await check('自訂金額不平衡、非成員付款與非法日期不寫入',async()=>{
    await reject(command(a,'save_expense',trip,{...expense,id:randomUUID(),split_mode:'custom',shares:{[ids[0]]:100,[partnerId]:0}}),'22023')
    await reject(command(a,'save_expense',trip,{...expense,id:randomUUID(),payer_id:ids[3]}),'22023')
    await reject(command(a,'save_expense',trip,{...expense,id:randomUUID(),date:'2026-02-30'}),'22008')
    await reject(command(nonMember,'save_expense',trip,expense),'42501')
  })
  await check('單人全額與自訂分攤寫入後由另一成員讀到',async()=>{
    const single={...expense,id:randomUUID(),split_mode:'single',single_member_id:partnerId}
    await command(a,'save_expense',trip,single)
    const custom={...expense,id:randomUUID(),split_mode:'custom',shares:{[ids[0]]:30,[partnerId]:71}}
    await command(a,'save_expense',trip,custom)
    const rows=(await snapshot(partner,trip)).expenses
    assert.equal(rows.find(e=>e.id===single.id).shares[ids[0]],0)
    assert.equal(rows.find(e=>e.id===custom.id).shares[partnerId],71)
  })
  await check('冪等 ID 防止並行重送與內容竄改',async()=>{
    const id=randomUUID(), payload={...expense,id:randomUUID()}
    const sameActor=await actor(ids[0])
    const result=await Promise.all([command(a,'save_expense',trip,payload,null,id),command(sameActor,'save_expense',trip,payload,null,id)])
    assert.deepEqual(result[0],result[1]); assert.equal((await owner.query('select * from public.ledger_expenses where id=$1',[payload.id])).rowCount,1)
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
    const payload={id:randomUUID(),payer_id:partnerId,receiver_id:ids[0],amount_jpy:20,date:'2026-11-21',notes:'部分轉帳'}
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
  await check('非成員不能猜 ID 修改、刪除或讀取對方帳務',async()=>{
    const e=(await snapshot(a,trip)).expenses[0]
    await reject(command(nonMember,'delete_expense',trip,{id:e.id},e.version),'42501')
    await reject(snapshot(nonMember,trip),'42501')
    assert.equal((await nonMember.query('select * from public.ledger_expenses')).rowCount,0)
  })
  await check('未登入角色無法讀取與呼叫帳務 RPC',async()=>{
    const anon=new pg.Client({host:'127.0.0.1',port:55432,user:'postgres',database}); await anon.connect();clients.push(anon)
    await anon.query('set role anon')
    await reject(snapshot(anon,trip),'42501')
    await reject(command(anon,'create_trip',null,{title:'forbidden'}),'42501')
    await reject(anon.query('select * from public.ledger_expenses'),'42501')
  })
  console.log(`\n${passed} PostgreSQL security/concurrency checks passed. Supabase Auth/email/Realtime delivery still require hosted verification.`)
} finally {
  await Promise.all(clients.map(c=>c.end().catch(()=>{})))
  if(owner) await owner.end().catch(()=>{})
  if(!admin.ended) { await admin.query(`drop database if exists ${database} with (force)`).catch(()=>{}); await admin.end().catch(()=>{}) }
}
