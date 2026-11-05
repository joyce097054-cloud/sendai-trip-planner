# 階段 1：私人旅程連結分帳（不需要 Email、密碼或會員）

這份說明已取代先前的 Email／Magic Link 方案。沿用現有 Supabase 專案，不需要 SMTP、驗證信、Email 範本、手動登入或建立個人檔案。使用者已同意發布階段 1 測試版供手機驗收；以下 Supabase 操作本身不會自動發布網站。

## 如何使用

第一次由一人填寫旅程名稱與兩位旅伴的顯示名稱，按「建立私人帳本」，再將產生的**完整私人旅程連結**傳給朋友。兩支 iPhone 開啟同一連結，就會在背景取得安全的匿名裝置身分，並讀取同一本雲端帳本。

- 付款人從兩位旅伴名稱選擇，不把任何手機或建立者指定為 A／B。
- 兩位「帳務參與者」固定；有存取權的匿名裝置數量不限於兩台。換手機、清除網站資料或改用主畫面模式時，用原私人連結重新進入即可。
- 日圓使用整數；平均分攤遇奇數，多的一圓由該筆付款人負擔。保留單人全額、自訂分攤、共同匯率、台幣估算、部分結算、篩選及 CSV。
- 任一手機新增不同消費採不同紀錄 ID，各自插入；不把整本帳本覆寫回資料庫。
- 編輯／刪除要比對版本，舊版本會被拒絕並保留表單輸入。斷線重連、切回前景及訂閱重新建立都重抓雲端快照；另有定期核對。
- 離線時禁止送出，不做離線佇列。失敗重試沿用冪等 ID，避免回應遺失後重複入帳。

## 你需要在 Supabase 做的事

### 1. 開啟背景匿名驗證

1. 開啟現有專案 Dashboard。
2. 進入 **Authentication → Sign In / Providers**（有些介面顯示 Providers）。
3. 找到 **Anonymous Sign-Ins／Anonymous**，啟用並儲存。

不需要開啟 Email 註冊、不需要設定 SMTP、不需要 Email Redirect URL。匿名驗證仍會在 Supabase Authentication 建立裝置用的 Anonymous Users，這不是個人會員資料，也不代表旅伴人數；不要限制只能建立兩筆。請確認沒有阻擋匿名使用者建立的專案政策。若原先有 Email 使用者，**不要刪除使用者或會員表**；新 App 不顯示舊登入流程，舊資料仍保留。

保留 Supabase 的 API 限流。若管理者另啟用需要互動的 CAPTCHA，本版尚未整合 CAPTCHA 元件，需另行接入，不能為此把資料庫開放給所有未驗證訪客。

### 2. 套用完整的新增 SQL

使用這份檔案：

[`supabase/migrations/202611050002_private_books.sql`](../supabase/migrations/202611050002_private_books.sql)

1. Supabase 左側 **SQL Editor → New query**。
2. 複製上述檔案的**完整內容**，貼入 SQL Editor。
3. 按 **Run**，確認沒有錯誤。

**新的空白專案只需要 002，不需要先跑舊的 001。** 若先前已跑 001，同樣只新增執行 002；它不修改、刪除、搬走或清空原本任何 `ledger_*` 資料。SQL 使用交易包住，失敗會回滾；不要用 DROP 或刪資料表來處理錯誤。002 是一次性的版本化 migration，已成功執行就不要重跑。

新表使用 `shared_ledger_*` 前綴：

| 資料 | 用途 |
| --- | --- |
| `shared_ledger_books` | 旅程與共同匯率 |
| `shared_ledger_participants` | 兩位帳務參與者的永久 UUID 與名稱 |
| `shared_ledger_devices` | 已通過私人連結驗證的裝置授權，可有多台 |
| `shared_ledger_links` | 私人連結的 SHA-256 雜湊，前端不能讀取 |
| `shared_ledger_expenses` | 每筆消費、分攤、版本及刪除標記 |
| `shared_ledger_settlements` | 實際轉帳紀錄、版本及刪除標記 |
| `shared_ledger_requests` | 防重送結果，前端不能直接讀取 |

所有新表都有 RLS。一般 `anon` role 沒有讀寫權；匿名登入拿到的 `authenticated` role，也必須先通過私人連結 RPC 才有指定帳本的權限。直接寫入資料表被禁止，修改統一走驗證式 RPC。

### 3. 確認 Realtime

002 會將可安全訂閱的五張表加入既有 `supabase_realtime` publication。可執行這個唯讀查詢確認：

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename like 'shared_ledger_%'
order by tablename;
```

應看到 `shared_ledger_books`、`shared_ledger_participants`、`shared_ledger_devices`、`shared_ledger_expenses`、`shared_ledger_settlements`。`links` 和 `requests` 不應被發布。若未建立 publication，先在 Supabase 的 Database／Replication 設定啟用 Realtime，再將以上五表加入；**不要關掉 RLS**。

### 4. 公開連線設定

沿用你提供的 Project URL／Publishable key。URL 必須是根網址：

```text
VITE_SUPABASE_URL=https://ubuurmxnxbutfvcmfkdj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你現有的公開 publishable key
```

URL 不加 `/rest/v1/`。不使用 `sb_secret_`、service_role key 或資料庫密碼；建置會拒絕私人 key。當前雲端機器已將公開 client 設定放在被 Git 忽略的 `.env.local`，沒有將金鑰寫入資料檔或 migration。

設定名稱、公開建議值及此專案網域已存入環境設定草稿；**草稿不等於已套用到執行中的機器**。如需套用，在環境設定檢查、儲存並發布環境。這不是 GitHub Pages 部署，也不會更新手機正在開啟的網站。

目前雲端對此 Supabase 網域的測試仍被代理以 CONNECT 403 阻擋，不能據此判定 key 錯誤，也不能宣稱正式專案已驗證完成。手機一般網路不受此雲端政策控制。

## 私人連結與裝置恢復

連結以 `#expenses?book=<256-bit 隨機值>` 開啟；秘密在 URL fragment，不會作為靜態網站請求的路徑／查詢參數傳到 GitHub Pages。後端只存雜湊，不公開原始私人碼。前端只在當次頁面記憶體與 sessionStorage 保留私人連結以供分享，財務資料仍以 PostgreSQL 為唯一權威來源。

**持有私人連結的人可讀寫此帳本。** 請將它像鑰匙一樣保管，只傳給旅伴，不貼到公開 GitHub、社群或公開截圖。私人連結在主動更新前可重複使用，不因清除手機瀏覽器資料而失效。

「重新產生私人連結」會使舊連結失效，撤銷其他裝置授權，只保留操作的裝置；朋友須使用新連結重新進入。這能真的撤回已外流的舊連結，而非只改顯示文字。輪替不刪除消費或結算。已關閉頁面且無原連結時，可向朋友索取，或由已有存取權的裝置重新產生。

匿名 Auth 使用者／裝置與帳本資料生命週期分開；清除手機、換匿名身分，甚至後端清理匿名使用者，都不會連帶刪除消費和結算。資料存於雲端，不代表對刪除 Supabase 專案、停用服務或資料庫損壞提供永久保證；仍請保留 CSV 備份。

## 如果已經有會員版帳務

002 不會自動將私人舊帳務變成持連結可讀的新帳本，也不要求刪除任何舊會員或資料表。原表、原 API、原紀錄完全保留。

如確認要遷移，在 SQL Editor 由專案管理者執行**選擇性複製**，不刪除原資料。先查出正確的舊旅程 ID：

```sql
select id, title from public.ledger_trips;
```

若表不存在，代表沒有舊帳本，跳過即可。若舊帳本已有兩位真實成員，可執行以下 SQL；只替換舊旅程 UUID：

```sql
with secret as materialized (
  select encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text,'UTF8')),'hex') as token
), copied as (
  select secret.token,
    public.shared_ledger_copy_legacy('替換成舊旅程的UUID'::uuid, secret.token) as result
  from secret
)
select result,
  case when (result->>'already_copied')::boolean then
    '已複製過，請使用原私人連結；本次不重設連結'
  else
    'https://joyce097054-cloud.github.io/sendai-trip-planner/#expenses?book=' || token
  end as private_link
from copied;
```

此函式只授權 SQL 管理者，不對 `anon` 或 App 裝置開放；會複製名稱、消費、版本、刪除標記、匯率與結算到新表。舊旅程 ID 有唯一來源約束，重複執行不覆寫、不重複匯入；原私人連結無法由雜湊反查，請保留首次產生的連結。上面的 UUID 是需替換的操作參數，不是可用示範帳本。此查詢產生的私人連結不要公開分享。

上面的私人連結需等階段 1 測試版在 GitHub Pages 完成發布後才能使用。沒有舊帳務時，不需要執行任何複製 SQL。

## 開發與驗證

```sh
npm run typecheck
npm run build
npm test
npm run test:db
npm run test:ledger
npm run test:e2e
```

`test:db` 使用隔離的真實 PostgreSQL 17（localhost 55432），測試全新專案只跑 002、保留舊資料、四個匿名裝置、RLS、冪等、同時新增、衝突、輪替及舊資料安全複製。測試 harness 只提供 Supabase 角色與 `auth.uid()` 契約，不冒充已驗證正式 Auth／Realtime。

```sh
docker run --detach --rm --name sendai-ledger-pg -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:55432:5432 postgres:17-alpine
# 等 PostgreSQL ready 後執行 npm run test:db
# 最後只停止自己啟動的本機測試容器：
docker stop sendai-ledger-pg
```

`test:ledger` 使用明確的測試用匿名 Auth／WebSocket 回應，驗證前端是否能背景驗證、收到變更通知後自動重抓、兩個獨立瀏覽器的介面、離線重連、重試及衝突。正式程式沒有 demo mode，不能把契約測試當作正式 Supabase 或兩支實際 iPhone 同步已完成。

最終仍需在實際專案與兩支 iPhone 驗證：同一私人連結開啟、新增／編輯／刪除自動同步、重整與關閉後重開、清除資料／換裝置恢復、離線重連、部分結算。Safari 與主畫面模式的實機驗收也不能用 Chromium 模擬取代。
