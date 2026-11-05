// Interface/API contract fixtures only. Real SQL/RLS/concurrency run separately
// against PostgreSQL. These tests do not claim hosted Auth/Realtime completion.
import { test, expect, type Page, type Route } from '@playwright/test'
const me='10000000-0000-4000-8000-000000000001', other='10000000-0000-4000-8000-000000000002', trip='20000000-0000-4000-8000-000000000001'
function base(){return {schema_version:1,profile:{id:me,name:'小雨',version:1},trips:[{id:trip,title:'測試帳本',owner_id:other,rate:'0.21',version:2}],trip:{id:trip,title:'測試帳本',owner_id:other,rate:'0.21',version:2},members:[{id:other,name:'小林',slot:1},{id:me,name:'小雨',slot:2}],expenses:[] as Record<string,unknown>[],settlements:[] as Record<string,unknown>[],invites:[]}}
const sample=()=>({id:'30000000-0000-4000-8000-000000000001',trip_id:trip,title:'既有午餐',amount_jpy:101,payer_id:me,date:'2026-11-20',split_mode:'equal',shares:{[me]:51,[other]:50},category:'餐飲',notes:'原始備註',version:1})
async function setup(page:Page,state:ReturnType<typeof base>,command:(route:Route,body:Record<string,unknown>)=>Promise<void>){
  await page.addInitScript(({me})=>{
    const user={id:me,aud:'authenticated',role:'authenticated',email:'ui-fixture@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-11-01T00:00:00Z'}
    const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:me,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}))+'.fixture'
    localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'ui-fixture-not-a-real-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}))
  },{me})
  await page.route('http://127.0.0.1:54321/**',async route=>{
    const url=route.request().url()
    if(url.includes('ledger_snapshot'))return route.fulfill({json:state})
    if(url.includes('ledger_command'))return command(route,route.request().postDataJSON())
    if(url.includes('/auth/v1/logout'))return route.fulfill({json:{}})
    return route.fulfill({status:503,json:{message:'UI contract test does not implement this endpoint'}})
  })
  await page.goto('/#expenses')
  await expect(page.getByRole('heading',{name:'測試帳本',exact:true})).toBeVisible()
}
test('自訂分攤需平衡、付款人預設本人，儲存及 CSV 操作使用雲端回傳',async({page})=>{
  const state=base(), requests:Record<string,unknown>[]=[]
  await setup(page,state,async(route,body)=>{
    requests.push(body)
    const p=body.p_payload as Record<string,unknown>
    state.expenses.push({...p,trip_id:trip,version:1})
    await route.fulfill({json:{ok:true,id:p.id}})
  })
  await page.getByRole('button',{name:'新增消費',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByLabel('消費名稱').fill('松島午餐')
  await dialog.getByLabel('金額（JPY）').fill('101')
  await expect(dialog.getByRole('combobox',{name:'付款人',exact:true})).toHaveValue(me)
  await dialog.getByLabel('分攤方式').selectOption('custom')
  await dialog.getByLabel('小林 應負擔 JPY').fill('40');await dialog.getByLabel('小雨 應負擔 JPY').fill('60')
  await dialog.getByRole('button',{name:'儲存消費'}).click()
  await expect(dialog.getByRole('alert')).toContainText('合計必須等於')
  expect(requests).toHaveLength(0)
  await dialog.getByLabel('小雨 應負擔 JPY').fill('61')
  await dialog.getByRole('button',{name:'儲存消費'}).click()
  await expect(dialog).toHaveCount(0)
  expect(requests).toHaveLength(1);expect(requests[0].p_expected_version).toBeNull()
  expect((requests[0].p_payload as Record<string,unknown>).payer_id).toBe(me)
  await expect(page.getByRole('heading',{name:'松島午餐',exact:true})).toBeVisible()
  await expect(page.locator('.ledger-summary h3')).toContainText('小林 需要付給 小雨')
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'匯出 CSV'}).click()
  expect((await downloaded).suggestedFilename()).toMatch(/\.csv$/)
})
test('收到新快照不覆蓋編輯草稿，過期版本會顯示衝突',async({page})=>{
  const state=base();state.expenses=[sample()];const versions:unknown[]=[]
  await setup(page,state,async(route,body)=>{versions.push(body.p_expected_version);await route.fulfill({status:400,json:{code:'40001',message:'changed'}})})
  await page.getByRole('button',{name:'編輯消費 既有午餐'}).click()
  const dialog=page.getByRole('dialog');await dialog.getByLabel('消費名稱').fill('保留我的草稿')
  state.expenses=[{...sample(),title:'另一人已修改',version:2}]
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading',{name:'另一人已修改',exact:true})).toBeAttached()
  await expect(dialog.getByLabel('消費名稱')).toHaveValue('保留我的草稿')
  await dialog.getByRole('button',{name:'儲存消費'}).click()
  await expect(dialog.getByRole('alert')).toContainText('未覆蓋雲端')
  expect(versions).toEqual([1])
})
test('離線阻止送出，快速連點只送一筆，失敗重試沿用冪等識別碼',async({page,context})=>{
  const state=base(),ids:unknown[]=[];let attempts=0
  await setup(page,state,async(route,body)=>{
    ids.push(body.p_request_id);attempts++
    if(attempts===1)return route.fulfill({status:503,json:{message:'unavailable'}})
    await new Promise(resolve=>setTimeout(resolve,180))
    const p=body.p_payload as Record<string,unknown>;state.expenses=[{...p,trip_id:trip,shares:{[me]:51,[other]:50},version:1}]
    return route.fulfill({json:{ok:true}})
  })
  await page.getByRole('button',{name:'新增消費',exact:true}).click()
  const dialog=page.getByRole('dialog');await dialog.getByLabel('消費名稱').fill('測試重試');await dialog.getByLabel('金額（JPY）').fill('101')
  await context.setOffline(true)
  await expect(dialog.getByRole('button',{name:'儲存消費'})).toBeDisabled();expect(ids).toHaveLength(0)
  await context.setOffline(false)
  await expect(dialog.getByRole('button',{name:'儲存消費'})).toBeEnabled()
  await dialog.getByRole('button',{name:'儲存消費'}).click()
  await expect(dialog.getByRole('alert')).toContainText('先重新同步')
  await dialog.getByRole('button',{name:'儲存消費'}).evaluate((button:HTMLButtonElement)=>{button.click();button.click()})
  await expect(dialog).toHaveCount(0)
  expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1])
})
test('邀請網址在登入初始化前可保留，伺服器拒絕過期邀請會明確提示',async({page})=>{
  const state=base();let received=''
  await setup(page,state,async(route,body)=>{received=String((body.p_payload as Record<string,unknown>).token);await route.fulfill({status:400,json:{code:'22023',message:'邀請碼無效、已使用或已過期'}})})
  const token='a'.repeat(64)
  await page.goto(`/?join=${token}#expenses`)
  await expect(page.getByLabel('加入旅伴的旅程')).toHaveValue(token)
  await page.getByRole('button',{name:'驗證並加入'}).click()
  await expect(page.getByRole('alert')).toContainText('已使用或已過期')
  expect(received).toBe(token)
})
