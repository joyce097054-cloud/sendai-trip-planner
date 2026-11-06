# 仙台賞楓五日自由行｜旅の手帖

手機優先的日式旅行手帳，供 2026/11/20–11/24 仙台、松島、岩沼自由行使用。React 19 + TypeScript + Vite + Tailwind CSS 4；原行程／指南／天氣無須登入；擴充中的雙人分帳使用背景匿名驗證、PostgreSQL 與 Realtime，沒有付費地圖 API。網站發布使用 GitHub Pages；本機資料不會上傳至 GitHub。

## 階段 1：私人連結雙人分帳（不需要手動登入）

新版以同一個私人旅程連結共用帳本，背景使用 Supabase Anonymous Auth，不顯示 Email、密碼、驗證信或會員畫面。兩位帳務參與者是固定的名字及 UUID，與裝置身分分離；換手機、清除瀏覽器或使用超過兩部裝置，都可用同一私人連結重新進入。

請依 [Supabase 設定與安全升級說明](docs/supabase-setup.md) 開啟 Anonymous Sign-Ins，並執行完整新增 SQL `supabase/migrations/202611050002_private_books.sql`。全新專案只跑 002；已有 001 資料也只新增 002，不刪除或覆寫舊資料。不需要 SMTP、Email 範本或登入回呼設定。

共同帳務只保存在 Supabase 雲端。保留平均／單人／自訂分攤、整數日圓、decimal 匯率、台幣估算、部分結算、篩選及 UTF-8 BOM CSV。不同消費逐筆新增，編輯以版本檢查避免舊資料覆寫；同一操作重送有冪等保護。斷線重連及切回前景重新讀取資料，離線禁止送出。

私人連結是讀寫帳本的鑰匙，不公開張貼；可以輪替並撤銷其他裝置權限。前端沒有 Secret key，資料庫仍以裝置授權及 RLS 驗證，不開放所有匿名訪客讀寫。舊會員表保留，必要時可由 SQL 管理者安全複製既有帳務，原資料不動。

使用者已確認階段 1 測試無誤，並授權階段 2 指南擴充；階段 2 尚未部署，線上網站仍是先前測試版。詳細的兩裝置測試與限制見 [階段 1 紀錄](docs/phase-1-status.md)，不以測試替身當作實機驗收。原本機 JSON 備份不含雲端帳務；分帳可另匯出 CSV。

## 階段 2：優惠券與免稅教學

指南新增章節導覽、App 內優惠券圖片檢視與縮放、日本退稅四章教學、可搜尋的 21 筆商家費用。資料分別位於 `src/data/coupons.json`、`src/data/tax-refund.json`；原有指南、行程、照片與天氣保留。

四張使用者提供的教學 JPG 已由 ZIP 匯入並依章節顯示，可在 App 內放大、捲動與關閉；保留原始位元組，未轉圖或壓縮。目前沒有真實券圖，只有標示不可使用的範例。使用者提供的費率與機場資訊均標為待官方核對，不假裝已查證。新增券圖、替換教學圖及更新文字的方式見 [指南內容維護](docs/guide-content.md)。本階段不需變更 Supabase 或重新執行 SQL。

## 手機使用：GitHub Pages（一次性設定）

發布目標是 `https://joyce097054-cloud.github.io/sendai-trip-planner/`。這是預定網址；只有 GitHub Pages 啟用並顯示部署成功後，才是可使用的網站。不要把預定網址當作已完成上線驗證。

發布檔案由 `npm run deploy:pages` 建置並推送到獨立的 `gh-pages` 分支，不合併或改寫 `main`。第一次需由專案管理員開啟 [GitHub Pages 設定](https://github.com/joyce097054-cloud/sendai-trip-planner/settings/pages)：

1. **Build and deployment → Source** 選 **Deploy from a branch**。
2. **Branch** 選 **gh-pages**，資料夾選 **/(root)**，按 **Save**。
3. 等 GitHub 顯示 **Your site is live at…**，再用手機 Safari 或 Chrome 開啟顯示的 HTTPS 網址。

若看不到 Pages 設定或方案不支援，請不要為了部署而自行改變私有儲存庫的可見性，應改選有權限的託管服務。此網站預設沒有登入與密碼；預載的旅行計畫公開可讀。照片、私人筆記、清單修改只存在各裝置的瀏覽器，部署不包含這些使用者內容。

- iPhone：Safari → 分享 → 加入主畫面。
- Android：Chrome → 選單 → 加入主畫面（此為網站捷徑，非離線安裝保證）。
- 不需在手機輸入任何指令。請避免使用聊天 App 的內建瀏覽器，以免資料和 Safari／Chrome 分隔。
- 從免安裝版或其他網址搬移資料，先匯出 JSON，再到正式網站匯入。不同裝置仍不會自動同步，請定期備份。
- 已儲存的頁面內容可留在頁面操作，但未實作 Service Worker；首次載入或重新開啟網站仍需網路。

更新網站：先將程式變更提交 Git，再執行 `npm run deploy:pages`。腳本檢查乾淨工作目錄、保留既有發布歷史、不強制推送，也拒絕覆寫未標示為此 App 的 `gh-pages`。`dist/deployment.json` 記錄來源提交及建置時間，方便確認上線版本。`npm run deploy:pages -- --prepare-only` 只建置，不推送。

可用 `npm run test:pages` 驗證正式產物在 `/sendai-trip-planner/` 子路徑的手機／桌面操作，避免開發首頁能開、部署卻找不到資源。真實站點仍需另外確認 HTTPS、首頁、插畫、路由與保存功能。

本雲端的 GitHub API 與站點連線若被網路政策阻擋，無法代替管理員完成首次 Pages 啟用及實際上線驗證。已將 `api.github.com`、`joyce097054-cloud.github.io`、`api.open-meteo.com` 加入環境網路設定草稿；草稿需在環境設定中儲存並發布環境後才套用。這與 GitHub Pages 的網站發布是兩件事，使用者的手機一般網路不受此雲端政策控制。

## Windows 免安裝開啟（不必輸入指令）

使用 [Windows 免安裝版下載](https://github.com/joyce097054-cloud/sendai-trip-planner/raw/refs/heads/feat/sendai-travel-journal/downloads/sendai-travel-journal.zip)，解壓縮到固定資料夾，再對 `sendai-travel-journal.html` 按右鍵 → 開啟檔案 → Microsoft Edge 或 Google Chrome。網頁本體、程式、樣式與插畫都已打包進單一檔案，不需要安裝 Node.js，也不需要啟動伺服器。

資料保存在瀏覽器中，並非直接寫回 HTML。請固定使用相同的瀏覽器與檔案位置；移動、更名、更新檔案或清除資料前先匯出完整 JSON 備份。電腦與手機不會自動同步。檔案來源的儲存行為因瀏覽器而異，已使用 Chromium 驗證單檔內容的保存、重新載入、照片與完整備份還原；雲端管理政策禁止 `file://`，因此尚未驗證 Windows 實機雙擊開檔。請定期備份。

手機不需要下指令，但手機的檔案預覽不一定能執行這份 HTML。若要用手機日常使用，需要可從手機連線的網站位址；本專案已準備 GitHub Pages 發布方式，需完成下方的一次性啟用設定。雲端伺服器的 `localhost` 無法在你的 Windows 或手機直接開啟。

開發者可執行 `npm run build:portable` 重建 `portable/`，或執行 `npm run test:portable` 驗證單檔內容（僅載入單一 HTML，沒有外部圖片或程式請求，含照片儲存及備份）。此雲端瀏覽器禁止 `file://`，測試透過模擬的本機 HTTP 文件驗證，不能取代 Windows 實機開檔確認。`portable/` 為開發輸出，不提交 Git；`downloads/sendai-travel-journal.zip` 是提供給使用者下載的版本快照。

## 開發者啟動方式

需要 Node.js 22.12 以上（此環境使用 Node.js 24）及 npm。

```sh
cd /workspace/sendai-trip-planner
npm ci
npm run dev
```

開發伺服器使用 5173 連接埠。只有在你自己的電腦執行上述指令後，才能在該電腦瀏覽 `http://localhost:5173`。雲端執行成功並不代表你的裝置可以連入該網址。這是開發預覽；正式手機存取使用下方的 GitHub Pages 方式。雲端沙箱如禁止監聽連接埠，需由執行工具授權啟動本機伺服器。

正式版本可執行 `npm run build`，再執行 `npm run preview`（預設連接埠 4173）。`dist/` 是建置輸出，未提交 Git。

## 可以做什麼

- 五天 36 筆行程，日期、時間、名稱、分類、交通、停留時間、標籤與備註全部可編輯。
- 新增、刪除、上下調整順序、依時間排序、跨日移動、勾選完成。
- 每站可開 Google Maps 大眾運輸或步行導航；路線總覽逐段連結，不偽裝 Google Maps 支援多站大眾運輸路線。
- 每站旅行筆記與多張照片；JPG/PNG/WebP 每張不超過 20 MB，長邊縮至最多 1600px 後存入 IndexedDB。
- 五類行李／購物清單，含指定購物項目、數量調整、增刪改、完成比例與確認後還原預設清單。
- 可編輯航班、住宿、訂單連結、個人補充資訊及自行查核後的飯店地址／電話。訂單只接受 http(s) 連結。
- 仙台／松島／岩沼 Open-Meteo 天氣、逐日涵蓋判斷、體感與降雨／日出日落資訊、失敗重試。
- Hash 頁面路由支援瀏覽器上一頁／下一頁，深連結如 `#guide`，不需要伺服器路由設定。
- 倒數與旅行第幾天依日本日期計算；航班皆為當地時間。

## 資料保存與備份

行程、清單與旅行資料使用 localStorage（`sendai-journal-v1`）；照片使用 IndexedDB（`sendai-photos`）。這些本機資料依瀏覽器與網站來源分隔，不會同步其他裝置。只有通過私人連結授權的分帳使用 Supabase 雲端同步。更換網域、連接埠、瀏覽器或清除資料前請先匯出。

右上角「資料備份」→「匯出完整 JSON 備份」包含文字資料與所有照片。匯入先驗證版本、欄位、編號、照片格式及關聯，再詢問是否取代；上限 100 MB。照片使用 base64 放入匯出的檔案，不放入 localStorage。大型照片集請定期另存原始照片；此 App 不取代專業相簿。

- 匯入取代目前全部資料，無合併與雲端復原。
- 儲存空間不足時顯示錯誤，請立即匯出當前內容。
- 已存文字損壞時暫停自動覆蓋，提供原始資料救援檔；救援檔需人工修復，不能直接當完整備份匯入。
- 無法讀取照片時不會悄悄匯出「少了照片」的備份。
- 請避免同時在多分頁編輯同一份資料；尚無跨分頁衝突合併功能。
- 備份可能包含私人筆記與照片，請保管好檔案。App 不預填護照或訂位代號，也不會上傳照片。點擊外部導航、官方連結或取得天氣時仍會連線到該服務。

## 資料來源與待確認事項

行程與航班為使用者提供的暫定計畫，存於 `src/data/itinerary.ts` 與 `src/data/guide.ts`。營業時間、店家現況、預約、交通時間、價格、夜間點燈及楓況均需出發前確認。染髮尚未預約；瑞鳳殿 16:00 抵達及夜間開放風險已特別標示。第 4 天保留使用者指定的計程車安排，可自行修改。

日本退稅改制日期 2026/11/1 依旅行需求提供，流程與規範尚待官方查核。頁面附日本海關、觀光廳、仙台市、台灣駐日機構、飯店與機場的官方連結及整理日期。未核實的地址和電話不預填；僅預設 110／119。

天氣來源：[Open-Meteo](https://open-meteo.com/)，每日預報最多未來 16 日，`Asia/Tokyo`，攝氏。資料取得時間不等於模式發布時間。尚未涵蓋的旅行日期顯示無資料；季節穿搭文字**不是即時預報或歷史平均值**，官方歷史氣候數據待確認。只有來源回傳 WMO 降雪代碼時顯示降雪預報，不推測積雪深度。

本雲端環境於 2026/11/05 驗證時，官方觀光網站、`api.open-meteo.com` 與 `api.github.com` 被網路政策拒絕（HTTP CONNECT 403）。天氣程式已以模擬成功／失敗資料測試，但不宣稱在此環境取得真實預報。若要在此雲端連線，需在環境設定允許相關目的網域；本機一般網路不受此雲端限制。

## 驗證

```sh
npm run typecheck
npm run build
npm test
# 首次執行瀏覽器測試前：
npx playwright install chromium
npm run test:e2e
```

測試設定會優先使用 Playwright 的 Chromium；此雲端已提供系統 Chromium，下載受限時會自動使用。也可用 `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` 明確指定。

單元測試涵蓋備份／照片資料驗證、保存失敗、完整資料往返、地圖編碼與天氣邊界。Playwright 使用 Chromium 的手機與桌面尺寸，測試真實互動、重新整理、照片 IndexedDB、備份還原及天氣錯誤；測試天氣使用可重現的攔截資料，不依賴外部 API。

若只修改預設資料，請注意已儲存的個人資料不會被新的預設值覆蓋。使用乾淨瀏覽器設定檔可檢視預設行程；還原清單只影響清單，不影響其他資料。

## 專案結構

```text
src/
  App.tsx                 頁面、資料保存、備份與倒數
  components/             行程、指南、天氣、對話框
  data/                   可維護的預設行程與指南資料
  lib/                    地圖、IndexedDB、備份驗證、天氣與單元測試
  types.ts                共用資料模型
  styles.css              響應式手帳樣式與 Tailwind
public/sendai-autumn.svg   專案內建的原創秋日插畫（無外部圖片依賴）
tests/app.spec.ts         瀏覽器整合測試
```

字體優先使用 Zen Maru Gothic；未安裝時使用 Noto Sans TC、蘋方、微軟正黑體等本機中文字型。沒有外部字體請求，離線已載入頁面仍可操作本機資料；本專案尚未加入 Service Worker，網路版本首次載入仍需可用的網站；電腦免安裝版已內含所有程式資源。
