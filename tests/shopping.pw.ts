// Explicit API/WebSocket fixtures; not a claim about hosted Supabase delivery.
import { test,expect,type Page,type WebSocketRoute } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const trip='20000000-0000-4000-8000-000000000001',token='b'.repeat(64)
type Row={id:string;name:string;quantity:number|null;shop:string;notes:string;done:boolean;owner_key:string;position:number;version:number}
function server(){
 const rows:Row[]=[],requests:Record<string,unknown>[]=[],sockets:{socket:WebSocketRoute;join:string;topic:string}[]=[]
 const seen=new Map<string,unknown>()
 function notify(){for(const s of sockets)s.socket.send(JSON.stringify([s.join,null,s.topic,'postgres_changes',{ids:[1],data:{schema:'public',table:'shared_shopping_items',type:'UPDATE',commit_timestamp:new Date().toISOString(),columns:[],record:{trip_id:trip},old_record:{}}}]))}
 return {rows,requests,notify,async attach(page:Page,missing=false,autoConnect=true){
  const id=randomUUID(),encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url'),jwt=encode({alg:'HS256'})+'.'+encode({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fixture'
  const user={id,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{provider:'anonymous'},user_metadata:{},created_at:'2026-11-10T00:00:00Z'},session={access_token:jwt,refresh_token:'shopping-contract-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}
  await page.routeWebSocket('ws://127.0.0.1:54321/realtime/**',socket=>socket.onMessage(message=>{const[join,ref,topic,event]=JSON.parse(String(message));if(event==='phx_join'){sockets.push({socket,join,topic});socket.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:[{id:1,event:'*',schema:'public',table:'shared_shopping_items',filter:`trip_id=eq.${trip}`}]}}]))}else if(event==='heartbeat')socket.send(JSON.stringify([null,ref,topic,'phx_reply',{status:'ok',response:{}}]))}))
  await page.route('http://127.0.0.1:54321/**',async route=>{
   const url=route.request().url();if(url.includes('/auth/v1/signup')||url.includes('/auth/v1/token'))return route.fulfill({json:session});if(url.includes('/auth/v1/user'))return route.fulfill({json:user})
   if(url.includes('shared_ledger_command'))return route.fulfill({json:{trip_id:trip}})
   if(url.includes('shared_ledger_snapshot'))return route.fulfill({json:{trip:{id:trip},trips:[{id:trip,title:'購物測試帳本'}]}})
   if(url.includes('shared_shopping_snapshot'))return missing?route.fulfill({status:404,json:{code:'PGRST202',message:'missing migration'}}):route.fulfill({json:{items:[...rows].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))}})
   if(url.includes('shared_shopping_command')){
    const body=route.request().postDataJSON();requests.push(body);const payload=body.p_payload as Row,existing=rows.find(r=>r.id===payload.id&&r.owner_key===payload.owner_key)
    if(seen.has(body.p_request_id))return route.fulfill({json:seen.get(body.p_request_id)})
    if(existing?.version!==body.p_expected_version&&!(body.p_expected_version===0&&!existing))return route.fulfill({status:409,json:{code:'40001',message:'stale'}})
    if(body.p_action==='delete')rows.splice(rows.indexOf(existing!),1);else if(existing)Object.assign(existing,payload,{version:existing.version+1});else rows.push({...payload,version:1})
    const result={id:payload.id};seen.set(body.p_request_id,result);notify();return route.fulfill({json:result})
   }
   return route.fulfill({status:404,json:{message:'not implemented in fixture'}})
  })
  await page.goto('/#guide');if(!autoConnect)return;await page.getByText('保存、備份與私人旅程同步',{exact:true}).click();await page.getByLabel('私人旅程連結（已有裝置授權可留白）',{exact:true}).fill(`https://example.test/#expenses?book=${token}`);await page.getByRole('button',{name:'連結私人帳本的購物清單',exact:true}).click()
  if(!missing){await expect(page.locator('#guide-shopping').getByText('私人旅程雲端清單',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'新增商品',exact:true})).toBeEnabled()}
 }}
}
async function add(page:Page,name:string){await page.getByRole('button',{name:'新增商品',exact:true}).click();await page.getByLabel('商品名稱',{exact:true}).fill(name);await page.getByRole('button',{name:'儲存商品',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)}
test('兩個裝置新增保留兩筆、即時事件更新、重新整理讀回雲端，兩人清單獨立',async({browser})=>{
 const api=server(),a=await browser.newContext(),b=await browser.newContext(),p=await a.newPage(),q=await b.newPage()
 await api.attach(p);await api.attach(q)
 await Promise.all([add(p,'手機甲商品'),add(q,'手機乙商品')]);await expect(p.locator('.shopping-list li')).toHaveCount(2);await expect(q.locator('.shopping-list li')).toHaveCount(2)
 await q.getByRole('button',{name:'條約的購物清單',exact:true}).click();await expect(q.locator('.shopping-list li')).toHaveCount(0);await add(q,'條約獨立商品')
 await p.getByRole('button',{name:'條約的購物清單',exact:true}).click();await expect(p.locator('.shopping-list li')).toHaveCount(1)
 await p.reload();await expect(p.locator('.shopping-list li')).toHaveCount(2);expect(api.rows).toHaveLength(3)
 await a.close();await b.close()
})
test('同筆舊表單顯示衝突並保留輸入，離線禁止送出，重連取最新',async({page,context})=>{
 const api=server();api.rows.push({id:'fixture-old',name:'原商品',quantity:1,shop:'',notes:'',done:false,owner_key:'lan',position:1000,version:1});await api.attach(page)
 await page.getByRole('button',{name:'編輯 原商品',exact:true}).click();await page.getByLabel('商品名稱',{exact:true}).fill('舊表單輸入')
 api.rows[0].name='朋友先改';api.rows[0].version=2;api.notify();await page.getByRole('button',{name:'儲存商品',exact:true}).click()
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText('另一支手機已修改');await expect(page.getByLabel('商品名稱',{exact:true})).toHaveValue('舊表單輸入');expect(api.rows[0].name).toBe('朋友先改')
 await page.getByRole('dialog').getByRole('button',{name:'關閉',exact:true}).click();await context.setOffline(true)
 await expect(page.getByRole('button',{name:'新增商品',exact:true})).toBeDisabled();api.rows[0].name='離線期間修改';await context.setOffline(false);await expect(page.locator('.shopping-list')).toContainText('離線期間修改')
})
test('未套用003時明示未啟用，本機預設不被清空或假裝同步',async({page})=>{
 const api=server();await api.attach(page,true);await expect(page.locator('#guide-shopping').getByRole('alert')).toContainText('003 SQL');await expect(page.locator('.shopping-list li')).toHaveCount(6);await expect(page.locator('#guide-shopping')).toContainText('尚未跨裝置同步')
})

function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done});return{promise,resolve}}
const otherTrip='20000000-0000-4000-8000-000000000002'
function backupFor(selected:string){return {format:'sendai-trip-backup',version:1,exportedAt:new Date().toISOString(),data:{version:1,stops:[],packing:[],details:{outbound:'JX862',inbound:'JX863',hotel:'測試飯店',orderLink:'',notes:''},planRevision:'2026-11-10',listsRevision:2,shopping:{lan:[],treaty:[]},shoppingCloudTrip:selected},photos:[]}}
async function restoreBook(page:Page,id:string){
 await page.getByRole('button',{name:'資料備份',exact:true}).click();page.once('dialog',dialog=>dialog.accept())
 await page.getByRole('dialog').locator('input[type=file]').setInputFiles({name:'scope-regression-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backupFor(id)))})
}

test('舊帳本寫入失敗不得重新抓舊快照污染剛匯入的另一帳本',async({page})=>{
 const api=server();api.rows.push({id:'shared-item-id',name:'帳本甲商品',quantity:1,shop:'',notes:'',done:false,owner_key:'lan',position:1000,version:1});await api.attach(page)
 const started=deferred(),release=deferred(),snapshotTrips:string[]=[]
 await page.route('http://127.0.0.1:54321/rest/v1/rpc/shared_shopping_snapshot',route=>{const id=route.request().postDataJSON().p_trip_id;snapshotTrips.push(id);return route.fulfill({json:{items:[{...api.rows[0],name:id===trip?'帳本甲商品':'帳本乙商品'}]}})})
 await page.route('http://127.0.0.1:54321/rest/v1/rpc/shared_shopping_command',async route=>{started.resolve();await release.promise;await route.fulfill({status:409,json:{code:'40001',message:'old book fixture conflict'}})})
 await page.getByLabel('帳本甲商品',{exact:true}).click();await started.promise
 await restoreBook(page,otherTrip);await expect(page.getByLabel('帳本乙商品',{exact:true})).toBeVisible()
 const before=snapshotTrips.length,finished=page.waitForResponse('**/rpc/shared_shopping_command');release.resolve();await finished
 await expect(page.locator('#guide-shopping').getByRole('alert')).toBeVisible()
 await expect(page.getByLabel('帳本乙商品',{exact:true})).toBeVisible();await expect(page.getByLabel('帳本甲商品',{exact:true})).toHaveCount(0)
 expect(snapshotTrips.slice(before)).not.toContain(trip)
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sendai-journal-v1')!).shoppingCloudTrip)).toBe(otherTrip)
})

test('帳本切換後晚到的舊快照與即時事件不能改寫新帳本',async({page})=>{
 const api=server();api.rows.push({id:'shared-item-id',name:'帳本甲商品',quantity:1,shop:'',notes:'',done:false,owner_key:'lan',position:1000,version:1});await api.attach(page)
 const started=deferred(),release=deferred()
 await page.route('http://127.0.0.1:54321/rest/v1/rpc/shared_shopping_snapshot',async route=>{const id=route.request().postDataJSON().p_trip_id;if(id===trip){started.resolve();await release.promise}await route.fulfill({json:{items:[{...api.rows[0],name:id===trip?'過期甲快照':'帳本乙商品'}]}})})
 await page.getByRole('button',{name:'重新同步購物清單',exact:true}).click();await started.promise
 await restoreBook(page,otherTrip);await expect(page.getByLabel('帳本乙商品',{exact:true})).toBeVisible()
 release.resolve();api.notify();await page.waitForLoadState('networkidle')
 await expect(page.getByLabel('帳本乙商品',{exact:true})).toBeVisible();await expect(page.getByLabel('過期甲快照',{exact:true})).toHaveCount(0)
})

test('離開再回指南後，舊連結請求完成不得替新畫面切換帳本',async({page})=>{
 const api=server();await api.attach(page,false,false)
 const started=deferred(),release=deferred()
 await page.route('http://127.0.0.1:54321/rest/v1/rpc/shared_ledger_command',async route=>{started.resolve();await release.promise;await route.fulfill({json:{trip_id:trip}})})
 await page.getByText('保存、備份與私人旅程同步',{exact:true}).click();await page.getByLabel('私人旅程連結（已有裝置授權可留白）',{exact:true}).fill(`https://example.test/#expenses?book=${token}`)
 await page.getByRole('button',{name:'連結私人帳本的購物清單',exact:true}).click();await started.promise
 const nav=page.getByRole('navigation',{name:'主導覽'});await nav.getByRole('link',{name:'行程 Itinerary',exact:true}).click();await nav.getByRole('link',{name:'指南 Guide',exact:true}).click()
 release.resolve();await page.waitForLoadState('networkidle')
 await expect(page.locator('#guide-shopping')).toContainText('此裝置 · 尚未跨裝置同步');await expect(page.locator('.shopping-list li')).toHaveCount(6)
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sendai-journal-v1')??'{}').shoppingCloudTrip)).toBeUndefined()
})


test('相同雲端rank時上移只移一位，僅更新需要重新編號的商品',async({page})=>{
 const api=server();for(const [id,position] of [['A',1000],['B',1000],['C',2000]] as const)api.rows.push({id,name:`排序${id}`,quantity:1,shop:'',notes:'',done:false,owner_key:'lan',position,version:1})
 await api.attach(page);await page.getByRole('button',{name:'上移 排序C',exact:true}).click()
 await expect(page.locator('.shopping-list .packing-check span')).toHaveText(['排序A','排序C','排序B'])
 expect(api.requests).toHaveLength(1);expect(api.requests[0]).toMatchObject({p_expected_version:1,p_payload:{id:'B',position:3000}})
 expect(api.rows.find(row=>row.id==='C')?.version).toBe(1)
})

test('重新編號途中衝突立即停止，不更新剩餘商品並防止重複重排',async({page})=>{
 const api=server();for(const [id,position] of [['A',1000],['B',1000],['C',1000],['D',2000],['E',2500]] as const)api.rows.push({id,name:`排序${id}`,quantity:1,shop:'',notes:'',done:false,owner_key:'lan',position,version:1})
 await api.attach(page);const firstStarted=deferred(),releaseFirst=deferred()
 await page.route('http://127.0.0.1:54321/rest/v1/rpc/shared_shopping_command',async route=>{
  const body=route.request().postDataJSON();api.requests.push(body);const payload=body.p_payload as Row,existing=api.rows.find(row=>row.id===payload.id)!
  if(api.requests.length===1){firstStarted.resolve();await releaseFirst.promise;Object.assign(existing,payload,{version:existing.version+1});const changed=api.rows.find(row=>row.id==='D')!;changed.version=2;changed.notes='朋友已修改，不能覆寫';api.notify();await route.fulfill({json:{id:payload.id}});return}
  expect(body.p_expected_version).toBe(1);expect(existing.id).toBe('D');expect(existing.version).toBe(2)
  await route.fulfill({status:409,json:{code:'40001',message:'concurrent reorder fixture conflict'}})
 })
 await page.getByRole('button',{name:'上移 排序D',exact:true}).click();await firstStarted.promise
 await expect(page.getByRole('button',{name:'上移 排序D',exact:true})).toBeDisabled();await expect(page.getByText('正在同步購物順序，請稍候。',{exact:true})).toBeVisible()
 releaseFirst.resolve();await expect(page.locator('#guide-shopping').getByRole('alert')).toContainText('部分排序已同步（1 項）')
 expect(api.requests).toHaveLength(2);expect(api.rows.find(row=>row.id==='D')).toMatchObject({position:2000,version:2,notes:'朋友已修改，不能覆寫'})
 expect(api.rows.find(row=>row.id==='C')).toMatchObject({position:1000,version:1});expect(api.rows.find(row=>row.id==='E')).toMatchObject({position:2500,version:1})
 await expect(page.getByRole('button',{name:'新增商品',exact:true})).toBeEnabled()
})
