// Explicit API/WebSocket fixtures; not a claim about hosted Supabase delivery.
import { test,expect,type Page,type WebSocketRoute } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const trip='20000000-0000-4000-8000-000000000001',token='b'.repeat(64)
type Row={id:string;name:string;quantity:number|null;shop:string;notes:string;done:boolean;owner_key:string;position:number;version:number}
function server(){
 const rows:Row[]=[],requests:Record<string,unknown>[]=[],sockets:{socket:WebSocketRoute;join:string;topic:string}[]=[]
 const seen=new Map<string,unknown>()
 function notify(){for(const s of sockets)s.socket.send(JSON.stringify([s.join,null,s.topic,'postgres_changes',{ids:[1],data:{schema:'public',table:'shared_shopping_items',type:'UPDATE',commit_timestamp:new Date().toISOString(),columns:[],record:{trip_id:trip},old_record:{}}}]))}
 return {rows,requests,notify,async attach(page:Page,missing=false){
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
  await page.goto('/#guide');await page.getByText('保存、備份與私人旅程同步',{exact:true}).click();await page.getByLabel('私人旅程連結（已有裝置授權可留白）',{exact:true}).fill(`https://example.test/#expenses?book=${token}`);await page.getByRole('button',{name:'連結私人帳本的購物清單',exact:true}).click()
  if(!missing)await expect(page.getByRole('button',{name:'新增商品',exact:true})).toBeEnabled()
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
