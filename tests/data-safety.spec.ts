import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const plan=JSON.parse(await readFile(new URL('../src/data/itinerary-2026-11-10.json',import.meta.url),'utf8'))
async function oldJournal(page:Page){
 const old={version:1,stops:[{...plan.stops[0],id:'safety-old',name:'保留中的原行程',notes:'原筆記',done:true}],packing:[],details:{outbound:'JX862',inbound:'JX863',hotel:'原飯店',orderLink:'',notes:''}}
 await page.addInitScript(data=>{if(!localStorage.getItem('sendai-journal-v1'))localStorage.setItem('sendai-journal-v1',JSON.stringify(data))},old)
 await page.goto('/')
 const stop=page.locator('.stop-row').first();await stop.getByText('旅記與照片',{exact:true}).click()
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=20;return c.toDataURL().split(',')[1]})
 await stop.locator('input[type=file]').setInputFiles({name:'safety-memory.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
 await expect(stop.getByRole('img',{name:'safety-memory.png',exact:true})).toBeVisible()
}
async function delayBackup(page:Page){
 await page.evaluate(()=>{
  const original=FileReader.prototype.readAsDataURL
  const callbacks:(()=>void)[]=[]
  ;(window as unknown as {releaseBackup:()=>void}).releaseBackup=()=>{callbacks.splice(0).forEach(fn=>fn())}
  FileReader.prototype.readAsDataURL=function(blob){callbacks.push(()=>original.call(this,blob));(window as unknown as {backupWaiting:boolean}).backupWaiting=true}
 })
 page.once('dialog',d=>d.accept())
 await page.getByRole('button',{name:'更新為正式行程並保留舊資料',exact:true}).click()
 await page.waitForFunction(()=>(window as unknown as {backupWaiting?:boolean}).backupWaiting)
}
test('備份與正式行程更新期間暫停編輯，排隊的舊回呼也不會覆寫勾選',async({page})=>{
 await oldJournal(page);await delayBackup(page)
 await expect(page.locator('#root > div[inert]')).toHaveCount(1)
 await page.locator('.complete-button').evaluate((el:HTMLElement)=>el.click())
 await expect(page.locator('.complete-button')).toHaveAttribute('aria-pressed','true')
 const download=page.waitForEvent('download');await page.evaluate(()=>(window as unknown as {releaseBackup:()=>void}).releaseBackup())
 const backup=JSON.parse(await readFile((await(await download).path())!,'utf8'));expect(backup.data.stops[0].done).toBe(true);expect(backup.photos).toHaveLength(1)
 await expect(page.locator('.timeline .stop-row')).toHaveCount(9);await expect(page.locator('#root > div[inert]')).toHaveCount(0)
 await page.locator('.archived-stops > summary').click();await expect(page.locator('.archived-stops .complete-button')).toHaveAttribute('aria-pressed','true')
})
test('另一個分頁在備份期間修改時，正式行程更新停止並保留新資料',async({page,context})=>{
 await oldJournal(page);await delayBackup(page)
 const other=await context.newPage();await other.goto('/#guide');await other.getByLabel('住宿名稱',{exact:true}).fill('另一分頁的新飯店')
 await page.evaluate(()=>(window as unknown as {releaseBackup:()=>void}).releaseBackup())
 await expect(page.locator('.storage-error')).toContainText('另一個分頁已修改資料')
 await expect(page.locator('.timeline .stop-row')).toHaveCount(1)
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sendai-journal-v1')!).details.hotel)).toBe('另一分頁的新飯店')
 await other.close()
})
test('照片尚在轉檔時禁止還原，既有照片儲存後仍可備份',async({page})=>{
 await page.goto('/')
 const stop=page.locator('.stop-row').first();await stop.getByText('旅記與照片',{exact:true}).click()
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=20;return c.toDataURL().split(',')[1]})
 await page.evaluate(()=>{const original=window.createImageBitmap;window.createImageBitmap=((...args:unknown[])=>new Promise(resolve=>{(window as unknown as {releasePhoto:()=>void}).releasePhoto=()=>resolve((original as unknown as (...v:unknown[])=>unknown)(...args))})) as typeof createImageBitmap})
 await stop.locator('input[type=file]').setInputFiles({name:'pending-memory.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
 await page.waitForFunction(()=>Boolean((window as unknown as {releasePhoto?:()=>void}).releasePhoto))
 await page.getByRole('button',{name:'資料備份',exact:true}).click()
 await page.getByRole('button',{name:'匯出完整 JSON 備份',exact:true}).click()
 await expect(page.getByRole('dialog')).toContainText('照片仍在處理中')
 const candidate={format:'sendai-trip-backup',version:1,exportedAt:'2026-11-11T00:00:00Z',data:{version:1,stops:plan.stops.map((s:Record<string,unknown>,i:number)=>i===0?{...s,name:'不應套用的還原資料'}:s),packing:[],details:{outbound:'JX862',inbound:'JX863',hotel:'還原飯店',orderLink:'',notes:''}},photos:[]}
 await page.getByRole('dialog').locator('input[type=file]').setInputFiles({name:'blocked-restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(candidate))})
 await expect(page.getByRole('dialog')).toContainText('照片仍在處理中');await expect(page.locator('.timeline')).not.toContainText('不應套用的還原資料')
 await page.evaluate(()=>(window as unknown as {releasePhoto:()=>void}).releasePhoto())
 await page.getByRole('dialog').getByRole('button',{name:'關閉',exact:true}).click()
 await expect(stop.getByRole('img',{name:'pending-memory.png',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'資料備份',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'匯出完整 JSON 備份',exact:true}).click()
 const b=JSON.parse(await readFile((await(await download).path())!,'utf8'));expect(b.photos).toHaveLength(1)
})
