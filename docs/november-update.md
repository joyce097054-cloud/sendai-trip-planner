# 2026/11/10 正式行程與功能更新

補修更新：2026/11/11（台灣）。本機備份與照片互斥、跨帳本晚到回應隔離、同順位排序及容量邊界已補強；原 003 SQL 不變。

本次從既有 `650c33d` 擴充，沒有從零重建。改版前備份分支 `backup/pre-nov10-update-650c33d`，完整 Git 備份 `/workspace/scratch/sendai-pre-nov10-update-650c33d.bundle` 已驗證。本次不合併 main、不更新網站發布分支；之前核准的測試版保持原狀。

## 完成的內容

- 以使用者這次提供的正式計畫建立五天預設資料。方案 A 每日 9／12／12／12／11，共 56 筆；另外保留第四天 B 的 2 筆替代資料，完整資料共 58 筆。方案 B 當天 11 筆，狐狸村與 18:00 橫綱為兩方案共用。
- 第四天 A／B 切換不刪除另一方案。各站編輯、排序、完成、筆記與照片以永久 ID 保存。手動新增第四天項目可選 A、B 或兩方案共用。
- 保留 Google Maps、照片 IndexedDB、JSON 備份、天氣與既有分帳。所有班次、營業、夜楓、日落、狐狸村冬季時間與橫綱地址的未核實資訊保留待確認；染髮與燒肉未顯示為已預約。
- 指南改為六個入口：打包、購物、優惠券、日本旅遊提醒（含原退稅教學）、緊急資訊、旅行資料。移除仙台實用資訊與相關導覽；原使用者 `practicalNotes` 隨 JSON 保留，沒有清除私人文字。
- 打包有十個可展開分類、64 項新預設、各類及整體進度、增刪改與數量。熱帶類預設收合，冬季提示保留；取消全部打包勾選需確認，不影響購物。
- 藍的六項購物預設與條約的空白清單獨立。含店家、數量待定、備註、排序、勾選、增刪改與 JSON。未重新加入 SHIRO。舊購物以原內容保留，不用新預設把已刪除商品補回。
- ZIP 內 7 張檔案全部以原位元組匯入：6 張靜態券及 `DONKI.jpg` 品牌入口。未裁切、重繪、轉格式或重建 QR／條碼；SHA-256 可校驗。DONKI 實際是 JPG，因此存為 `donki-logo.jpg`。
- 一般券全螢幕、保留比例、可放大與捲動，資料結構支援多張左右切換／滑動。本 ZIP 每店只有一張，沒有為展示多圖而複製。原圖可由 PWA 離線讀取。
- 唐吉訶德整張卡片連結至指定官方原網址，`target="_blank" rel="noopener noreferrer"`，不嵌 iframe。Logo 不是核銷券，離線阻止開啟並顯示需網路。
- 四片輕量 SVG 楓葉，CSS transform／opacity 動畫，預設開啟、可關閉、localStorage 記憶、尊重減少動態設定，背景分頁暫停。切換日期不重建；所有對話框開啟時隱藏並暫停，不卡住觸控／條碼。

## 舊資料如何更新

首次使用的新裝置直接載入正式計畫。已有資料的裝置先顯示自己的舊行程及更新提示，不會自動被最新預設覆蓋。

選「更新為正式行程並保留舊資料」後，先確認並下載含照片的完整備份，接著才保存新安排。舊站的 ID、筆記、照片關聯與勾選留在各日「舊行程存檔」，可查看、編輯或手動放回。舊站不參與新路線與新進度，不會自動重新加入取消的餐廳。儲存或備份失敗時不採用新行程。

也可選「先保留目前行程」，日後從「資料備份」開啟更新。App 無法替你確認瀏覽器是否實際將下載檔保存到指定位置，請自行確認檔案存在。

舊打包依內容放入新分類，既有名稱、ID、數量與完成狀態保留；缺少的新預設以新增方式補入。舊購物從 packing 移到獨立 shopping，原商品、數量與狀態保留；藍與條約各自儲存。請不要清除 localStorage／IndexedDB。原 v1 備份仍可匯入；新欄位仍使用向後相容的 v1 格式與額外驗證。

## 補修的資料保護

- 更新、匯入及完整備份期間暫停本機編輯；照片轉檔／保存未完成時，拒絕開始會取代資料的操作。還原失敗會保留原有照片，跨分頁發生修改則停止覆寫並提示重新整理。
- 舊打包最多保留 2000 項，缺少的預設僅在剩餘容量內補入。保留舊行程再加正式資料若將超過 1000 筆，明確拒絕更新；請先確認備份再整理舊行程，不清空資料。
- 若舊站 ID 與新預設相同，新站使用不衝突 ID，原站與照片關聯保持原樣，不會因此少一個正式安排。
- 切換購物帳本或離開指南後，舊請求、重試與即時事件只屬於原本的帳本，不可將晚到的舊快照放到新帳本畫面。
- 兩支手機同時新增可能產生相同排序位置。上移／下移仍只移一位，必要時依捕獲版本逐筆重新編號；中途衝突即停止並明示部分結果，不能覆蓋另一人的修改。

## 購物跨裝置：還需要套用 003

**目前正式 Supabase 尚未由本環境套用或驗收購物同步。預設先本機使用，介面不會宣稱已同步。** 現有分帳不需重設，購物沿用同一私人連結及背景匿名裝置權限，沒有 Email、密碼或新會員流程。

1. 在現有 Supabase 的 **SQL Editor → New query** 開啟新查詢。
2. 複製 [`supabase/migrations/202611100003_shopping_lists.sql`](../supabase/migrations/202611100003_shopping_lists.sql) 的完整內容，貼上並 Run **一次**。需先已有 002；不要重跑 001／002、不 DROP 或重建既有表。
3. 003 只新增 `shared_shopping_items`、`shared_shopping_requests`、兩個購物 RPC，以及 items 的 Realtime 發布；不修改原分帳表、計算、會員資料或 RPC。交易失敗會回滾。若出現「already exists」，先停止並執行下方唯讀檢查，不要刪表處理。
4. 執行 [唯讀安裝確認 SQL](../supabase/checks/20261110_shopping_setup.sql)，應回傳 **5 列，ready 都為 true**。它只查安裝狀態，不會修改或讀出私人購物內容。下方原查詢也保留供參考。
5. 在新版指南「日本購物清單 → 保存、備份與私人旅程同步」貼上原私人連結並連結。已取得帳本授權的同一裝置可以留白；沒有帳本者先在分帳建立。私人連結只交給旅伴。
6. 雲端剛建立時為空白。確認後，可將各自本機的藍／條約清單逐筆加入雲端；既有相同編號不覆寫。本機原清單仍留著，可隨時返回。若部分失敗，已成功新增的商品保留，先同步後重試。
7. 另一手機以同一私人連結連結，應取得同一本旅程的兩份清單；重新整理、切回前景、斷線恢復都重新讀取。離線禁止雲端送出，不做離線佇列。

```sql
select '資料表' as 類型, c.relname as 項目,
       case when c.relrowsecurity then '存在，RLS 已啟用' else 'RLS 未啟用' end as 狀態
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('shared_shopping_items','shared_shopping_requests')
union all
select '函式', f.name, case when to_regprocedure(f.signature) is not null then '存在' else '缺少' end
from (values
 ('shared_shopping_snapshot','public.shared_shopping_snapshot(uuid)'),
 ('shared_shopping_command','public.shared_shopping_command(uuid,uuid,text,integer,jsonb)')
) f(name,signature)
union all
select 'Realtime','shared_shopping_items',case when exists(
 select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shared_shopping_items'
) then '已加入' else '待啟用' end;
```

兩個名字只是旅程內的清單分類；真正權限來自匿名 Auth UUID＋私人連結授權的裝置成員與資料庫 RLS。持有這本旅程連結的兩位都可編輯兩份清單，不提供彼此隱藏的個人清單。改前端名字或旅程 ID 都不能取得其他旅程的權限。直接寫表被禁止，每筆寫入經 RPC 檢查版本與冪等 ID；不同商品各自插入，不整本覆寫。刪除保留 tombstone，舊表單不能復活。原分帳的連結輪替同時撤銷購物存取權。

完整旅行 JSON 包含**本機**購物與照片；雲端購物可另匯出兩份清單的 JSON，匯入先至本機、經確認後逐筆加入雲端。分帳仍另匯出 CSV，不包含於購物 JSON。

## 優惠券管理與適用性

- 檔案：`public/coupons/`；資料：`src/data/coupons.json`。`imagePath` 為封面，`images` 為同店完整圖片陣列。新增店家時以唯一 id、分類、券面說明／日期及來源建立，日期不明用 null。
- 靜態券用 `kind: "static"`，動態券用 `kind: "external"`＋HTTPS `externalUrl`；唐吉訶德網址必須保持需求指定原網址。一般券不跳外站。
- `sources` 記錄原檔名和 SHA-256，替換原圖時同步更新；`npm run check:guide` 會確認全部畫面圖片及校驗。管理方式見 [指南內容維護](guide-content.md)。
- 日期與文字依使用者券面整理，並非即時官方查核。尤其樂天券限**銀座**，列有羽田／成田出境條件，本行程由仙台出境不可預設可用。所有券在新退稅制度下的適用方式、分店及排除商品請結帳前確認。
- 若之後公開部署，`public/coupons/` 的靜態原圖也可能被公開存取；不要放私人資料。本次只有開發分支，不更新公開網站。

## 預覽與測試

完整可操作的單檔預覽為 `portable/sendai-travel-journal.html`，由 `npm run build:portable` 生成，已內嵌全部 11 張圖片（6 張券圖、4 張教學圖及 1 張 Logo）。下載提供的 ZIP、解壓縮後用 Windows Edge／Chrome 開啟；此預覽是本機檔案，不是新公開網站。雲端管理的瀏覽器禁止 file://，自動化以同一 HTML 的本機 HTTP 文件驗證；Windows 雙擊、iPhone Safari／主畫面仍需實機確認。手機預覽需經另行核准的 HTTPS 測試網站，本次不部署。

開發者：`npm ci` → `npm run dev`；正式產物 `npm run build`，需本機確認可用時再 `npm run preview`。雲端 localhost 不是手機可用網址。

| 檢查 | 本次結果 |
| --- | --- |
| TypeScript、建置、原圖校驗 | 通過 |
| 單元測試 | 52 項通過 |
| 手機／桌面互動 | 47 項通過，1 項桌面略過手機限定項目 |
| 原分帳合約 | 10 項通過 |
| 新購物合約 | 8 項通過，含兩獨立裝置、帳本隔離、晚到事件、排序碰撞、衝突及離線 |
| 正式子路徑 | 8 項通過 |
| 單檔備份與圖片 | 1 項通過 |
| 原生 Service Worker | 6 項通過，含全部券圖離線與 Donki 連線限制 |
| 隔離 PostgreSQL | 14 項通過；PGlite 真正執行 SQL、constraints、RLS，Auth UUID 用測試環境模擬 |

瀏覽器合計 80 項。PostgreSQL 測試為單連線內嵌引擎，不等於真實多連線競態；API／WebSocket 為明確合約替身。正式 Supabase Auth／Realtime、兩支 iPhone 安全與同步、Safari／主畫面完整矩陣、官方動態券實際啟用都**尚未驗收**。`003` 未在正式專案執行。歷史分帳多連線 PostgreSQL 測試本次未重跑，既有 SQL 未改。

開發測試新增依賴只有 `@electric-sql/pglite`，不進前端包。主要 JS 約 655 kB（gzip 約 193 kB），保留 Vite 大包警告，未宣稱完成實際手機網路效能量測。

GitHub API 仍受本雲端網路政策限制時，無法自動建立 PR；保留可審核的分支及 PR 本文，不將比較連結當作已建立 PR。發布、合併 main 均須另行確認。
