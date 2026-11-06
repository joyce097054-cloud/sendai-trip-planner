// Browser interface/API-contract fixtures only. This suite does not establish
// hosted Supabase Auth, RLS or Realtime delivery; real PostgreSQL has its own suite.
import { test, expect, type BrowserContext, type Page, type Route, type WebSocketRoute } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const lin='10000000-0000-4000-8000-000000000001', rain='10000000-0000-4000-8000-000000000002', trip='20000000-0000-4000-8000-000000000001'
const privateToken='a'.repeat(64)
function base(){return {schema_version:1,profile:null,trips:[{id:trip,title:'測試私人帳本',owner_id:'90000000-0000-4000-8000-000000000001',rate:'0.21',version:2}],trip:{id:trip,title:'測試私人帳本',owner_id:'90000000-0000-4000-8000-000000000001',rate:'0.21',version:2},members:[{id:lin,name:'小林',slot:1},{id:rain,name:'小雨',slot:2}],expenses:[] as Record<string,unknown>[],settlements:[] as Record<string,unknown>[],invites:[]}}
const sample=()=>({id:'30000000-0000-4000-8000-000000000001',trip_id:trip,title:'既有午餐',amount_jpy:101,payer_id:rain,date:'2026-11-20',split_mode:'equal',shares:{[rain]:51,[lin]:50},category:'餐飲',notes:'原始備註',version:1})
type Command=(route:Route,body:Record<string,unknown>)=>Promise<unknown>
type SocketSubscription={socket:WebSocketRoute;join:string|null;topic:string;filters:{id:number;table?:string}[]}
function realtimeFixture(){
  const subscriptions:SocketSubscription[]=[]
  return {
    async attach(page:Page){
      await page.routeWebSocket('ws://127.0.0.1:54321/realtime/**',socket=>{
        socket.onMessage(message=>{
          const [join,ref,topic,event,payload]=JSON.parse(String(message))
          if(event==='phx_join'){
            const filters=(payload.config?.postgres_changes??[]).map((f:Record<string,unknown>,index:number)=>({...f,id:index+1}))
            subscriptions.push({socket,join,topic,filters})
            socket.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:filters}}]))
          }else if(event==='phx_leave'){
            for(let index=subscriptions.length-1;index>=0;index--)if(subscriptions[index].socket===socket&&subscriptions[index].topic===topic)subscriptions.splice(index,1)
            socket.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:{}}]))
          }else if(event==='heartbeat')socket.send(JSON.stringify([null,ref,topic,'phx_reply',{status:'ok',response:{}}]))
        })
      })
    },
    notify(table:string,record:Record<string,unknown>){
      for(const subscription of subscriptions){
        const ids=subscription.filters.filter(filter=>filter.table===table).map(filter=>filter.id)
        if(ids.length)subscription.socket.send(JSON.stringify([subscription.join,null,subscription.topic,'postgres_changes',{ids,data:{schema:'public',table,type:'INSERT',commit_timestamp:new Date().toISOString(),columns:[],record,old_record:{}}}]))
      }
    },
  }
}
async function setup(page:Page,state:ReturnType<typeof base>,command:Command=async route=>route.fulfill({json:{ok:true}}),options:{token?:string;invalidToken?:boolean;emptyStart?:boolean}={}){
  const authId=randomUUID(), stats={signups:0,opens:0,snapshots:0,authId}
  const user={id:authId,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{provider:'anonymous'},user_metadata:{},created_at:'2026-11-01T00:00:00Z'}
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url')
  const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:authId,role:'authenticated',is_anonymous:true,exp:Math.floor(Date.now()/1000)+3600})+'.fixture'
  const session={access_token:token,refresh_token:'ui-contract-fixture-not-a-real-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}
  await page.route('http://127.0.0.1:54321/**',async route=>{
    const url=route.request().url()
    if(url.includes('/auth/v1/signup')){stats.signups++;return route.fulfill({json:session})}
    if(url.includes('/auth/v1/user'))return route.fulfill({json:user})
    if(url.includes('/auth/v1/token'))return route.fulfill({json:session})
    if(url.includes('shared_ledger_snapshot')){stats.snapshots++;return route.fulfill({json:state})}
    if(url.includes('shared_ledger_command')){
      const body=route.request().postDataJSON() as Record<string,unknown>
      if(body.p_action==='open_book'){
        stats.opens++
        expect((body.p_payload as Record<string,unknown>).token).toBe(options.token??privateToken)
        if(options.invalidToken)return route.fulfill({status:403,json:{code:'42501',message:'私人連結無效或已被更換'}})
        return route.fulfill({json:{trip_id:trip}})
      }
      return command(route,body)
    }
    return route.fulfill({status:503,json:{message:'UI contract test does not implement this endpoint'}})
  })
  await page.goto(options.emptyStart?'/#expenses':`/#expenses?book=${options.token??privateToken}`)
  if(!options.invalidToken&&!options.emptyStart)await expect(page.getByRole('heading',{name:'測試私人帳本',exact:true})).toBeVisible()
  return stats
}
async function newExpense(page:Page,title:string,amount='101',payer=rain){
  await page.getByRole('button',{name:'新增消費',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByLabel('消費名稱').fill(title)
  await dialog.getByLabel('金額（JPY）').fill(amount)
  await dialog.getByRole('combobox',{name:'付款人',exact:true}).selectOption(payer)
  return dialog
}
function insertFromPayload(state:ReturnType<typeof base>,body:Record<string,unknown>){
  const p=body.p_payload as Record<string,unknown>, amount=Number(p.amount_jpy), payer=String(p.payer_id)
  // Deterministic UI response fixture, not a duplicate production calculation.
  const shares=p.shares??{[payer]:Math.ceil(amount/2),[payer===lin?rain:lin]:Math.floor(amount/2)}
  state.expenses.push({...p,shares,trip_id:trip,version:1})
  return p
}

test('私人連結自動建立匿名存取，重新開啟及清除裝置資料後不需要 Email 登入',async({page})=>{
  const state=base(),stats=await setup(page,state)
  expect(stats.authId).not.toBe(lin);expect(stats.authId).not.toBe(rain)
  expect(stats.signups).toBe(1);expect(stats.opens).toBeGreaterThanOrEqual(1)
  await expect(page.locator('input[type=email],input[type=password]')).toHaveCount(0)
  await expect(page.getByRole('button',{name:/寄送|登入|註冊|驗證碼/})).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading',{name:'測試私人帳本',exact:true})).toBeVisible()
  expect(stats.signups).toBe(1)
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()})
  await page.goto(`/#expenses?book=${privateToken}`)
  await page.reload()
  await expect(page.getByRole('heading',{name:'測試私人帳本',exact:true})).toBeVisible()
  expect(stats.signups).toBe(2)
  await expect(page.locator('.ledger-members')).toContainText('小林')
  await expect(page.locator('.ledger-members')).toContainText('小雨')
})

test('付款人使用真實參與者名稱，自訂分攤必須平衡，儲存及 CSV 使用雲端回傳',async({page})=>{
  const state=base(),requests:Record<string,unknown>[]=[]
  await setup(page,state,async(route,body)=>{requests.push(body);const p=insertFromPayload(state,body);await route.fulfill({json:{ok:true,id:p.id}})})
  await page.getByRole('button',{name:'新增消費',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByLabel('消費名稱').fill('松島午餐');await dialog.getByLabel('金額（JPY）').fill('101')
  await expect(dialog.getByRole('combobox',{name:'付款人',exact:true})).toHaveValue('')
  await dialog.getByRole('combobox',{name:'付款人',exact:true}).selectOption(rain)
  await dialog.getByLabel('分攤方式').selectOption('custom')
  await dialog.getByLabel('小林 應負擔 JPY').fill('40');await dialog.getByLabel('小雨 應負擔 JPY').fill('60')
  await dialog.getByRole('button',{name:'儲存消費'}).click()
  await expect(dialog.getByRole('alert')).toContainText('合計必須等於');expect(requests).toHaveLength(0)
  await dialog.getByLabel('小雨 應負擔 JPY').fill('61')
  await dialog.getByRole('button',{name:'儲存消費'}).click();await expect(dialog).toHaveCount(0)
  expect(requests).toHaveLength(1);expect(requests[0].p_expected_version).toBeNull()
  expect((requests[0].p_payload as Record<string,unknown>).payer_id).toBe(rain)
  await expect(page.getByRole('heading',{name:'松島午餐',exact:true})).toBeVisible()
  await expect(page.locator('.ledger-summary h3')).toContainText('小林 需要付給 小雨')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({path:'/workspace/scratch/sendai-phase3-ledger-contract-mobile.png',animations:'disabled'})
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'匯出 CSV'}).click()
  expect((await downloaded).suggestedFilename()).toMatch(/\.csv$/)
})

test('新快照不覆蓋編輯草稿，過期版本會顯示衝突',async({page})=>{
  const state=base();state.expenses=[sample()];const versions:unknown[]=[]
  await setup(page,state,async(route,body)=>{versions.push(body.p_expected_version);await route.fulfill({status:400,json:{code:'40001',message:'changed'}})})
  await page.getByRole('button',{name:'編輯消費 既有午餐'}).click()
  const dialog=page.getByRole('dialog');await dialog.getByLabel('消費名稱').fill('保留我的草稿')
  state.expenses=[{...sample(),title:'另一支手機已修改',version:2}]
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading',{name:'另一支手機已修改',exact:true})).toBeAttached()
  await expect(dialog.getByLabel('消費名稱')).toHaveValue('保留我的草稿')
  await dialog.getByRole('button',{name:'儲存消費'}).click();await expect(dialog.getByRole('alert')).toContainText('未覆蓋雲端')
  expect(versions).toEqual([1])
})

test('離線阻止送出，快速連點只送一筆，失敗重試沿用冪等識別碼',async({page,context})=>{
  const state=base(),ids:unknown[]=[];let attempts=0
  await setup(page,state,async(route,body)=>{
    ids.push(body.p_request_id);attempts++
    if(attempts===1)return route.fulfill({status:503,json:{message:'unavailable'}})
    await new Promise(resolve=>setTimeout(resolve,180));insertFromPayload(state,body)
    return route.fulfill({json:{ok:true}})
  })
  const dialog=await newExpense(page,'測試重試')
  await context.setOffline(true)
  await expect(dialog.getByRole('button',{name:'儲存消費'})).toBeDisabled();expect(ids).toHaveLength(0)
  await context.setOffline(false);await expect(dialog.getByRole('button',{name:'儲存消費'})).toBeEnabled()
  await dialog.getByRole('button',{name:'儲存消費'}).click();await expect(dialog.getByRole('alert')).toContainText('先重新同步')
  await dialog.getByRole('button',{name:'儲存消費'}).evaluate((button:HTMLButtonElement)=>{button.click();button.click()})
  await expect(dialog).toHaveCount(0);expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1])
})

test('兩個獨立裝置同時新增保留兩筆，重新連線後取得完整新快照',async({browser})=>{
  const state=base();const contexts:BrowserContext[]=[],feed=realtimeFixture()
  try{
    const a=await browser.newContext(),b=await browser.newContext();contexts.push(a,b)
    const p=await a.newPage(),q=await b.newPage()
    await Promise.all([feed.attach(p),feed.attach(q)])
    const handler:Command=async(route,body)=>{const record=insertFromPayload(state,body);await route.fulfill({json:{ok:true}});feed.notify('shared_ledger_expenses',{...record,trip_id:trip})}
    const [first,second]=await Promise.all([setup(p,state,handler),setup(q,state,handler)])
    expect(first.authId).not.toBe(second.authId)
    await expect(p.locator('.ledger-sync')).toContainText('即時連線已建立')
    await expect(q.locator('.ledger-sync')).toContainText('即時連線已建立')
    const [one,two]=await Promise.all([newExpense(p,'第一支手機午餐','100',lin),newExpense(q,'第二支手機車票','60',rain)])
    await Promise.all([one.getByRole('button',{name:'儲存消費'}).click(),two.getByRole('button',{name:'儲存消費'}).click()])
    await expect(one).toHaveCount(0);await expect(two).toHaveCount(0);expect(state.expenses).toHaveLength(2)
    // Virtual Realtime notifications must trigger automatic snapshot reads; no manual refresh.
    for(const device of [p,q]){
      await expect(device.getByRole('heading',{name:'第一支手機午餐',exact:true})).toBeVisible()
      await expect(device.getByRole('heading',{name:'第二支手機車票',exact:true})).toBeVisible()
    }
    await a.setOffline(true)
    state.expenses.push({...sample(),id:randomUUID(),title:'離線期間的新紀錄'})
    await a.setOffline(false)
    await p.evaluate(()=>window.dispatchEvent(new Event('online')))
    await expect(p.getByRole('heading',{name:'離線期間的新紀錄',exact:true})).toBeVisible()
  }finally{await Promise.all(contexts.map(c=>c.close()))}
})

test('部分結算只減少應付餘額，不刪除原始消費',async({page})=>{
  const state=base();state.expenses=[sample()]
  await setup(page,state,async(route,body)=>{
    expect(body.p_action).toBe('save_settlement')
    const p=body.p_payload as Record<string,unknown>;expect(p.payer_id).toBe(lin);expect(p.receiver_id).toBe(rain)
    state.settlements.push({...p,trip_id:trip,version:1});await route.fulfill({json:{ok:true}})
  })
  await page.getByRole('button',{name:'記錄已結算',exact:true}).click()
  const dialog=page.getByRole('dialog');await dialog.getByLabel('已結算日圓').fill('20')
  await dialog.getByRole('button',{name:'儲存結算紀錄'}).click();await expect(dialog).toHaveCount(0)
  await expect(page.locator('.ledger-summary h3')).toContainText('¥30')
  await expect(page.getByRole('heading',{name:'既有午餐',exact:true})).toBeVisible()
  expect(state.expenses).toHaveLength(1);expect(state.settlements).toHaveLength(1)
})

test('失效私人連結不顯示他人帳務，也不提示 Email 登入',async({page})=>{
  await setup(page,base(),undefined,{token:'b'.repeat(64),invalidToken:true})
  await expect(page.getByRole('alert')).toContainText(/私人連結|權限|存取/)
  await expect(page.getByRole('heading',{name:'測試私人帳本',exact:true})).toHaveCount(0)
  await expect(page.locator('input[type=email],input[type=password]')).toHaveCount(0)
})


test('首次只填旅程與兩人名稱即可建立私人帳本及分享連結',async({page})=>{
  const state=base(),ready=base();Object.assign(state,{trip:null,trips:[],members:[]})
  let sentToken=''
  const stats=await setup(page,state,async(route,body)=>{
    expect(body.p_action).toBe('create_book')
    const payload=body.p_payload as {title:string;names:string[];token:string}
    expect(payload.names).toEqual(['阿晴','小月']);expect(payload.token).toMatch(/^[a-f0-9]{64}$/)
    sentToken=payload.token
    const created={...ready.trip,title:payload.title,rate:null}
    Object.assign(state,{trip:created,trips:[created],members:[{id:lin,name:payload.names[0],slot:1},{id:rain,name:payload.names[1],slot:2}]})
    await route.fulfill({json:{trip_id:trip,version:1}})
  },{emptyStart:true})
  await expect(page.getByRole('heading',{name:'建立私人帳本',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'建立私人帳本',exact:true})).toBeDisabled()
  await page.getByLabel('旅程名稱', {exact:true}).fill('我們的仙台行')
  await page.getByLabel('旅伴 1 名稱', {exact:true}).fill('阿晴')
  await page.getByLabel('旅伴 2 名稱', {exact:true}).fill('小月')
  await page.getByRole('button',{name:'建立私人帳本',exact:true}).click()
  await expect(page.getByRole('heading',{name:'我們的仙台行',exact:true})).toBeVisible()
  await expect(page.locator('.ledger-members')).toContainText('阿晴')
  await page.getByText('私人連結與帳本設定', {exact:true}).click()
  await expect(page.getByLabel('私人旅程連結', {exact:true})).toHaveValue(new RegExp('#expenses\\?book='+sentToken+'$'))
  expect(stats.signups).toBe(1)
  await expect(page.locator('input[type=email],input[type=password]')).toHaveCount(0)
})

test('連結格式錯誤時也能貼上正確連結，背景恢復而不顯示登入',async({page})=>{
  const options={token:'not-a-valid-token',invalidToken:true}
  const stats=await setup(page,base(),undefined,options)
  await expect(page.getByRole('alert')).toContainText('格式不正確')
  expect(stats.signups).toBe(0)
  options.token=privateToken;options.invalidToken=false
  await page.getByLabel('已有私人旅程連結',{exact:true}).fill('http://127.0.0.1:5174/#expenses?book='+privateToken)
  await page.getByRole('button',{name:'開啟私人帳本',exact:true}).click()
  await expect(page.getByRole('heading',{name:'測試私人帳本',exact:true})).toBeVisible()
  expect(stats.signups).toBe(1)
  await expect(page.locator('input[type=email],input[type=password]')).toHaveCount(0)
})

test('窄手機與鍵盤高度下表單可捲動，關閉後回到新增消費',async({page})=>{
  const state=base()
  state.members[0].name='ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN'
  state.members[1].name='這是一個用來檢查換行的旅行夥伴顯示名稱'
  await setup(page,state)
  await page.setViewportSize({width:320,height:430})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  const trigger=page.getByRole('button',{name:'新增消費',exact:true})
  await trigger.click()
  const dialog=page.getByRole('dialog')
  await dialog.getByLabel('消費名稱').fill('鍵盤操作測試')
  await dialog.getByLabel('備註（選填）').fill('只驗證表單操作，不送出帳務')
  const submit=dialog.getByRole('button',{name:'儲存消費',exact:true})
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport()
  const bounds=(await dialog.boundingBox())!
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.y+bounds.height).toBeLessThanOrEqual(430)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
