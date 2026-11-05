# 階段 1：Supabase 設定與雙人分帳驗收

這份指南搭配分支 `feat/shared-expenses-and-guide`。程式已提供連接方式，不代表你已建立 Supabase 專案、寄信已成功或線上網站已更新。本階段不部署新版。

## 1. 建立專案

1. 用電腦開啟 <https://supabase.com/dashboard> 並登入。
2. 建立／選擇免費方案的 Organization，再按 **New project**。
3. 專案名稱可填 `sendai-trip-planner`，選亞洲區域。資料庫密碼自行安全保管，不需要交給前端或貼在聊天。
4. 等待專案啟動。

## 2. 設定兩個公開連線值

Supabase 的介面名稱可能更新，通常可在 **Project Settings → Data API** 找 Project URL，在 **API Keys** 找 Publishable key；**Connect** 也可能顯示應用程式連線資訊。

在 Codex 雲端環境設定的環境變數填入：

| 名稱 | 填入的值 |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL，格式為 `https://你的專案ID.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 以 `sb_publishable_` 開頭的公開 client key；舊專案可用 role 為 `anon` 的 legacy key |

**不要使用 `sb_secret_`、service_role key 或資料庫密碼。** Vite 的 `VITE_` 變數會公開打包到瀏覽器；私人 key 不能放在這裡。建置也會拒絕不符條件的 key。

環境變數名稱已加入環境設定草稿。儲存草稿不代表目前執行中的機器已取得值；若產品要求發布環境，請在環境設定儲存並發布環境以套用。這不是部署網站，也不會自動更新 GitHub Pages。

若是在自己的電腦開發，複製 `.env.example` 為 `.env.local`，填入公開值並重新啟動 Vite；不要把 `.env.local` 加入 Git。

取得專案 ID 後，雲端執行環境還要允許 `你的專案ID.supabase.co` 的 HTTPS／WebSocket 連線。若此處有政策阻擋，需先更新並套用環境網路設定；不要更換到假 API 或繞過代理。Supabase 專案的資料庫密碼不需要放進此 App。

## 3. 執行建表 SQL

1. 在 Supabase 左側開啟 **SQL Editor → New query**。
2. 開啟專案檔案 [`supabase/migrations/202611050001_ledger.sql`](../supabase/migrations/202611050001_ledger.sql)，複製完整內容。
3. 貼到 SQL Editor，按 **Run**。
4. 確認沒有錯誤。這份初始 migration 包含 transaction；若失敗，不要刪除表格後亂重試，先保留錯誤訊息以便診斷。

這是新帳務的初始 migration，勿在已有同名前綴帳務資料的專案重跑；後續修改使用新的版本化 migration，不重設資料。既有行程與照片仍在你的裝置，本 SQL 不讀取、刪除或搬動那些資料。

本版為固定兩人成員模型，將兩份分攤以成員 UUID 與整數欄位存於同一消費列，讓資料庫 `CHECK` 可直接確保合計等於總額；前端不顯示內部 slot、不以 slot 指定付款人。與階段 0 的分表構想相比，這個方式減少跨列合計失衡的機會。

### Realtime 確認

Migration 會將五張可讀資料表加入既有 `supabase_realtime` publication。可在 SQL Editor 執行以下唯讀查詢：

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename like 'ledger_%'
order by tablename;
```

應有：`ledger_profiles`、`ledger_trips`、`ledger_members`、`ledger_expenses`、`ledger_settlements`。邀請雜湊與請求結果不公開訂閱。若專案沒有該 publication，需先依 Supabase 的 Database／Replication 設定啟用，再加入以上表格；不可關掉 RLS 來讓同步看似成功。

## 4. Email 登入與回呼

在 **Authentication → URL Configuration** 設定：

- **Site URL**：`https://joyce097054-cloud.github.io/sendai-trip-planner/`
- **Redirect URLs** 加入：
  - `https://joyce097054-cloud.github.io/sendai-trip-planner/`
  - `http://localhost:5173/`
  - `http://127.0.0.1:5173/`

如另用預覽連接埠，僅加入實際需要的完整位址；不需要開放所有網站。程式使用根路徑 `?code` 回呼及 PKCE，不需要建立 `/auth/callback`，避免 GitHub Pages 回傳 404。

在 **Authentication → Sign In / Providers**（或相應登入設定）確認 Email 登入已啟用。

### 登入信加入驗證碼

在 **Authentication → Email Templates**，為 **Magic Link** 和首次註冊使用的 **Confirm signup** 範本保留確認連結，同時加入 `{{ .Token }}`。例如：

```html
<h2>仙台旅行帳本登入</h2>
<p>請用原本要求登入的 Safari 或 Chrome 開啟連結。</p>
<p><a href="{{ .ConfirmationURL }}">登入旅行帳本</a></p>
<p>若開到不同瀏覽器，也可以回到原畫面輸入驗證碼：</p>
<p><strong>{{ .Token }}</strong></p>
```

Supabase 預設寄信可能有限制。兩位旅伴都必須實際收到登入信；若預設寄信不適合，請在 Supabase 的 SMTP 設定連接有效的寄信服務。SMTP 密碼只填在 Supabase 安全設定，不填 `VITE_` 變數，不交給瀏覽器。

Email App 可能將連結開到不同瀏覽器，主畫面模式與 Safari 的登入儲存也可能不同。PKCE 若找不到原瀏覽器 verifier，App 會顯示錯誤；請回原瀏覽器重寄，或輸入登入信中的 OTP。不要將登入連結或驗證碼分享給別人，也不需要貼給開發者。

## 5. 兩人使用流程

此版本尚未部署到原網站；先在可執行新版的開發環境驗證。電腦本機開發可執行 `npm ci`、`npm run dev`，用該電腦的瀏覽器開啟 Vite 網址。不要將雲端 `localhost` 當成手機可用網址。要在實際手機測試新版，需要後續核准的 HTTPS 測試／正式站點；此輪不會擅自部署。

1. 兩人各用自己的 Email 登入，設定想顯示的名字。誰先建立旅程不代表誰是固定的 A／B。
2. 一人建立旅程，再按「產生邀請連結」。連結有效 24 小時、單次使用；重新產生會撤銷舊邀請。
3. 另一人開啟邀請連結並登入，設定名字後按「驗證並加入」。也可以貼上完整連結或邀請碼。
4. 兩位真實成員齊備後，才能新增消費。付款人預設為目前登入者，可改成任一成員。
5. 平均、自訂或單人全額皆以日圓記帳；平均的奇數餘額由該筆付款人負擔。
6. 任一人設定共同匯率後，另一人同步使用。未設定時不顯示假台幣數字。
7. 旅伴轉帳後，按「記錄已結算」填入實際金額和日期，支援部分結算。轉帳不算新消費。
8. 「匯出 CSV」包含消費、雙方分攤及結算，UTF-8 BOM 可供 Excel／Sheets 使用。

若邀請連結已離開產生頁，原始碼不會從資料庫取回（只存雜湊），可重新產生再分享。不要拿範例帳號或示範支出當真實驗收。

## 6. 衝突、離線與重送

- 離線時帳務送出停用，不建立稍後自動上傳的佇列。
- 同一個表單重試保留原紀錄 ID 與 request ID；資料庫對相同內容回傳原結果，避免回應遺失後再入帳。
- 版本不符時保留表單輸入並顯示衝突，請先記下要保留的內容，關閉後同步再開啟，不會自動覆蓋另一人。
- 不確定是否已儲存時先重新同步，不要直接新增另一張相同消費。
- 即時連線失敗會標示中斷，重連、回前景及定期核對時重新讀取雲端。畫面顯示的「最近讀取」是本機取得快照的時間，不是對方裝置完成同步的證明。
- 登出分帳只清除帳務顯示／驗證，不刪除原有行程、清單與照片。

## 7. 測試與尚未完成的驗收

```sh
npm run typecheck
npm run build
npm test
npm run test:db
npm run test:ledger
npm run test:e2e
```

`test:db` 使用僅綁定 `127.0.0.1:55432` 的隔離 PostgreSQL 17，建立隨機命名的暫存資料庫，驗證後移除。它不連正式 Supabase，也不接收正式資料庫連線字串。可先在開發電腦啟動測試服務：

```sh
docker run --detach --rm --name sendai-ledger-pg -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:55432:5432 postgres:17-alpine
# PostgreSQL ready 後執行 npm run test:db
# 測試完只停止自己啟動的容器：
docker stop sendai-ledger-pg
```

上述信任模式只供隔離的 localhost 測試，不能套用到正式資料庫。SQL 測試 harness 只提供 Supabase 角色與 `auth.uid()` 契約，真正在 PostgreSQL 執行 migration／RLS／RPC／並行寫入；不能代替 Supabase Auth 寄信或 Realtime 傳送驗收。

`test:ledger` 是帶明確測試資料的瀏覽器介面／API 契約測試，沒有假帳號進入正式 App，亦不能用其通過宣稱雲端同步完成。正式程式不含 demo mode，未設定或無資料時明確顯示狀態。

仍需在實際專案與兩個獨立帳號驗證：寄信及登入、一次性邀請、彼此新增／修改／刪除即時看到、斷線後重連、重整、換裝置、RLS 越權、版本衝突及部分結算。iPhone Safari 與主畫面 PWA 實機驗收屬後續階段，不以 Chromium 模擬替代。
