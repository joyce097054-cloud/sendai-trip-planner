# 指南內容、券圖與教學圖維護

更新：2026/11/10（台灣時間）。四張免稅教學原圖保留原始 JPG，本次再匯入使用者提供的六張優惠券及 DONKI 品牌入口；沒有生成或替代券圖。

## 管理目前的優惠券

2026/11/10 已將「日本優惠券.zip」的 7 張原圖匯入：6 張券（鶴羽、Bic Camera、Sundrug、JINS、KokuMiN、LOTTE GINZA）及 DONKI 品牌入口 JPG，已移除舊範例。原位元組與完整條碼保留。詳見 [本次交付](november-update.md)。

1. 將自行取得的原始 JPG／PNG／WebP 放入 `public/coupons/`，用英數檔名，不裁切條碼或轉格式。
2. 在 `src/data/coupons.json` 的 `items` 加入唯一 id，填 `shopName`、`category`、`offerSummary`、`instructions`、`conditions`、`validFrom`、`validUntil`、`sourceNotes` 與 `isExample: false`。未知條件寫待確認，未知日期用 null。
3. 靜態券用 `kind: "static"`，`imagePath` 為封面，`images` 按順序列出全部 `/coupons/...` 原圖。多張時顯示切換按鈕，未放大時可左右滑動；現有 ZIP 每店只有一張。
4. 動態券用 `kind: "external"`、`imagePath` 作品牌入口圖、`externalUrl` 為官方 HTTPS 網址。唐吉訶德使用需求指定網址，不可將 Logo 當核銷券；離線不能開啟。
5. `sources` 填原檔名與圖片 SHA-256，更新 `updatedAt`，執行 `npm run check:guide`／`npm run build`。更新圖片先備份原檔與提交，保留來源追溯。
6. 開啟原圖核對比例、有效日期、優惠條件及縮放。截止日以日本日期判斷，過期不自動刪除，明示已過期。

券面內容已整理但未獨立查核新制下的受理方式；不把券面期限當成現場保證。LOTTE 為銀座店且列有羽田／成田出境條件，這次仙台出境不可預設適用。若未來公開部署，靜態券圖也可能被公開存取。

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
