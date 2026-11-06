# 指南內容、券圖與教學圖維護

更新：2026/11/06（台灣時間）。階段 2 的程式、文字與四張教學原圖已整合。原圖由使用者的 ZIP 提供，保留原始 JPG 位元組；真實優惠券圖尚未提供。本版不包含生成的優惠券或教學圖。

## 新增一張真實優惠券

1. 將你自行截圖或下載的 JPG、PNG、WebP 放入 `public/coupons/`。檔名使用英文字母、數字與連字號，例如 `bic-camera-202611.jpg`；可用子資料夾。
2. 開啟 `src/data/coupons.json`，在 `items` 新增一筆，保留其他券。`id` 必須唯一；`category` 使用上方 `categories` 中的分類。初始分類為 Bic Camera、藥妝、百貨、電器／其他。
3. 填妥以下欄位；資訊未知時明寫「待確認」，日期未知用 `null`。日期以日本當地日期為準，格式 `YYYY-MM-DD`。

| 欄位 | 填寫方式 |
| --- | --- |
| `id` | 唯一代碼，例如 `bic-camera-202611` |
| `shopName` | 券上實際店名 |
| `category` | `categories` 中的一個分類 |
| `offerSummary` | 券面實際優惠簡述，不自行推定優惠率 |
| `imagePath` | `/coupons/bic-camera-202611.jpg`，不含 `public`；未取得圖片時為 `null` |
| `instructions` | 字串陣列，逐項記錄使用步驟 |
| `conditions` | 字串陣列，記錄分店、金額、排除項目等實際條件 |
| `validFrom`、`validUntil` | 開始及結束日期，未知為 `null` |
| `sourceNotes` | 來源與取得日期等追溯資訊，App 只顯示文字，不作為跳轉入口 |
| `isExample` | 真實券為 `false`；範例／佔位資料為 `true` |

4. 更新檔案頂端 `updatedAt`，執行 `npm run check:guide` 與 `npm run build`。
5. 在指南的「優惠券」開啟該券，確認完整圖片、放大、使用條件及有效期間都正確。若資料有誤，先改回範例或移除該筆，避免誤用。

目前只放一筆明確的 Bic Camera 範例，`isExample: true`、`imagePath: null`，不能出示使用；收到真實券後可刪除這筆範例。不要把範例改成真實券，卻仍保留範例內容。

有效期限涵蓋截止日當天，日本日期進入翌日便標示「已過期」。尚未開始顯示「尚未生效」，未填截止日顯示「有效期限待確認」。標示日期仍不代表店家保證接受使用。切回 App 或背景恢復時會更新判斷。

圖片只接受專案內 `/coupons/` 或 `/tax-refund/` 的 JPG／PNG／WebP，不使用外站圖、iframe、SVG、相對跳脫路徑。優惠券詳情留在 App 內，可用縮放按鈕與捲動查看、關閉或 Escape 返回。圖片載入失敗時仍可讀取條件。

## 四張教學原圖

四張原圖已由使用者提供的 ZIP 取得，以下對應已加入專案，`image.available` 均為 `true`：

| 章節 | 檔案 | JSON `sections[].id` |
| --- | --- | --- |
| 日本退稅平台 APP 整理 | `public/tax-refund/01-platforms.jpg` | `platforms` |
| 事先下載與網頁加入主畫面 | `public/tax-refund/02-prepare-home-screen.jpg` | `prepare` |
| VJW 與機場手續機台比較 | `public/tax-refund/03-vjw-kiosk.jpg` | `airport` |
| 機場現金退稅機台整理 | `public/tax-refund/04-cash-refund.jpg` | `cash` |

後續替換圖片時，先保留舊圖與 Git 提交，再放入新原檔，核對內容與次序。`src/data/tax-refund.json` 的 `image.sourceFilename`、`image.sha256` 記錄這次的原始檔名與 SHA-256，`imagesReceivedAt` 為收件日期；替換後應一併更新。若新檔為 PNG／WebP，保留原格式並修改 `image.path`，不要只更改副檔名。若暫時移除圖片，將對應 `image.available` 改為 `false`，App 仍保留文字教學並顯示缺圖提示。

可用圖片由章節內的按鈕開啟同一個 App 對話框，具放大、縮小、原尺寸與關閉功能。不要自行重畫原圖或放入生成替代圖。

## 退稅文字與費用資料

內容集中在 `src/data/tax-refund.json`，不需修改 UI 元件：

- `compiledAt`：文字整理日期；`imagesReceivedAt`：原圖收件日期；`officialVerifiedAt`：實際查核官方的日期，尚未查核為 `null`。收到原圖不代表費率已查證。
- `source`、`verificationStatus`、`sources`：來源類型、待核對狀態與官方查核入口。列出官方連結不代表已讀取或確認內容。
- `overview`、`sections`：教學摘要、章節順序、導覽文字、圖片與 `rawText` 原文。保留使用者原文；有新查核結果時另加註查核資料，不悄悄覆蓋原文。
- `platforms`、`preparation`、`refundMethods`：四個平台、證件準備與兩種退款方式。
- `downloadOptions`、`homeScreenSteps`：預先下載及加入主畫面步驟。
- `comparison`、`wifi`：VJW 與 KIOSK 比較表及使用者提供的公共 Wi-Fi 資訊。
- `cashProviders`、`cashReminder`：兩種現金退稅業者、提供的機場清單與費用提醒。
- `merchantGroups`、`merchants`：21 筆商家費率，包含 `fee` 原文、`basis` 計費基礎、`platform` 與 `notes`。搜尋比對商家與平台名稱。
- `sendaiNotice`：本次從仙台出境，但使用者提供的 VJW 七機場與現金機台清單都未列仙台；適用方式待官方確認。
- `legacyPreparation`：原有指南的旅前退稅提醒，仍可展開閱讀。

保留未稅價、含稅價、消費稅額及每筆固定日圓的區別。申請費 0% 不代表提領／匯款／換匯免費；不直接把不同計費基礎相加。LUMINE／NEWoMan 未填費率維持待確認，不當作 0%；mont-bell 額外提領費保留原文。所有提供的費率、平台、Wi-Fi 與支援機場目前均未獨立核實，出發前應再核對官方與店家規則。

## 保存、建置與預覽

本階段不變更 `sendai-journal-v1`、IndexedDB 照片、JSON 個人備份格式、Supabase 帳本或 SQL。優惠券與教學為專案靜態內容，不會將帳務資料寫入它們，也不會自動同步個人行程。

`npm run check:guide` 會檢查已指定／標為可用的圖片是否存在且位於 `public` 內；`npm run build` 先執行相同檢查。尚未取得的教學原圖維持明確待補，不以假圖讓檢查通過。圖片路徑支援 GitHub Pages 的 `/sendai-trip-planner/` 子路徑。

開發預覽：在專案目錄執行 `npm run dev`，使用開發環境提供的預覽入口；程式印出的 `localhost` 只代表執行該程式的電腦，不是手機可用的公開網址。這個指令不會部署網站。階段 2 尚未部署，原線上網站不會自動顯示本次修改。

`npm run build:portable` 可重建電腦單檔版，會將已提供且可用的指南圖片一起內嵌。未提供的原圖不會出現在單檔版。`portable/` 是忽略提交的本機產物，不會自動更新既有下載 ZIP 或公開網站；雲端分帳仍需網路。分享單檔前應確認券圖的使用條件與內容，並保護私人帳本連結。
