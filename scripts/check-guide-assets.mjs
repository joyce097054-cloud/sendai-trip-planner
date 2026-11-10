import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
const root=resolve(import.meta.dirname,'..'),publicRoot=await realpath(resolve(root,'public'))
const coupons=JSON.parse(await readFile(resolve(root,'src/data/coupons.json'),'utf8'))
const tax=JSON.parse(await readFile(resolve(root,'src/data/tax-refund.json'),'utf8'))
if(!Array.isArray(coupons.items)||!Array.isArray(tax.sections))throw new Error('指南資料格式不正確，請檢查 items 與 sections。')
async function verify(path){
 if(typeof path!=='string'||!/^\/(coupons|tax-refund)\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(png|jpe?g|webp)$/i.test(path)||path.slice(1).split('/').some(p=>p==='..'||p==='.'||p===''))throw new Error('指南圖片路徑須為專案內 JPG／PNG／WebP。')
 const target=await realpath(resolve(publicRoot,'.'+path)).catch(()=>{throw new Error(`圖片不存在：public${path}。請先放入檔案，再標示可用。`)})
 if(!target.startsWith(publicRoot+sep)||!(await stat(target)).isFile())throw new Error('指南圖片必須是 public 內的檔案。')
}
for(const c of coupons.items)for(const path of new Set([c.imagePath,...(c.images??[])].filter(Boolean)))await verify(path)
for(const s of tax.sections)if(s.image.available)await verify(s.image.path)
console.log(`Guide assets checked: ${coupons.items.filter(c=>c.imagePath).length} coupon images; ${tax.sections.filter(s=>s.image.available).length} teaching images ready; ${tax.sections.filter(s=>!s.image.available).length} original images pending.`)

for(const source of coupons.sources??[]){await verify(source.path);if(!/^[a-f0-9]{64}$/.test(source.sha256))throw new Error('優惠券 SHA-256 格式不正確');const bytes=await readFile(resolve(publicRoot,'.'+source.path));if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw new Error(`優惠券原圖校驗失敗：${source.path}`)}
