import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Produce a self-contained file: no server, CDN, font or asset requests.
const root = resolve(import.meta.dirname, '..')
let html = await readFile(resolve(root, 'dist/index.html'), 'utf8')
const script = html.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/)
const stylesheet = html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)
if (!script || !stylesheet) throw new Error('Cannot find the Vite entry assets; build the app first.')
const asset = url => resolve(root, 'dist', url.replace(/^\//, ''))
const svg = await readFile(resolve(root, 'public/sendai-autumn.svg'))
const image = `data:image/svg+xml;base64,${svg.toString('base64')}`
let javascript = await readFile(asset(script[1]), 'utf8')
const hero = JSON.stringify('sendai-autumn.svg')
if (!javascript.includes(hero)) throw new Error('Hero asset was not found; portable build needs updating.')
javascript = javascript.replaceAll(hero, JSON.stringify(image)).replace(/<\/script/gi, '<\\/script')
const css = (await readFile(asset(stylesheet[1]), 'utf8')).replace(/<\/style/gi, '<\\/style')
html = html.replace(script[0], () => `<script type="module">${javascript}</script>`)
html = html.replace(stylesheet[0], () => `<style>${css}</style>`)
await mkdir(resolve(root, 'portable'), { recursive: true })
await writeFile(resolve(root, 'portable/sendai-travel-journal.html'), html)
await writeFile(resolve(root, 'portable/請先閱讀.txt'), '\uFEFF仙台賞楓五日自由行 — Windows 免安裝版\r\n\r\n1. 將壓縮檔解壓縮到固定資料夾。\r\n2. 對 sendai-travel-journal.html 按右鍵 → 開啟檔案 → Microsoft Edge 或 Google Chrome。\r\n3. 不需要安裝程式或輸入任何指令。\r\n\r\n請固定使用相同瀏覽器、相同檔名與位置。移動或更名、換瀏覽器、清除資料前，先按右上角「資料備份」匯出 JSON（包含照片）。資料不會自動同步到手機或其他電腦。\r\n天氣和 Google Maps 需要網路；行程、清單與旅記不需伺服器。手機上的檔案預覽可能不執行程式；這份免安裝版是給電腦瀏覽器使用。\r\n\r\n這不是公開網站，未部署至網際網路。\r\n')
console.log('Portable app built: portable/sendai-travel-journal.html')
