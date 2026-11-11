# 仙台繪本風改版

以現有專案改版，發布沿用原 GitHub Pages 網址。改版前保護點：`backup/pre-storybook-a6438d4`。本次沒有修改行程資料檔、優惠券原圖、免稅教學原圖、儲存格式或 Supabase SQL／權限。

- 和紙白 `#FFFCF6`、墨灰 `#3E3A39`，主要容器採 3px 線框、大圓角與平塗。珊瑚粉、山吹黃、水色、若竹綠分別用於操作、頁籤、交通與提示。
- 主導覽移到頂端 sticky header，保留四頁的連結、名稱、選取狀態與分頁捲動記憶；支援安全區域。既有 `.bottom-nav` class 為相容選取器保留，位置由繪本主題控制。
- 首頁使用原創 SVG：伊達政宗騎馬像、松島小島與松樹、電車、三隻小狐狸。插圖為裝飾，非交通地圖。
- 航班卡片讀取現有 `TravelDetails.outbound/inbound`，指南修改後立即反映，沒有另存一份航班資料。
- 保留五日日期切換、時間軸、兩個第四天方案、編輯、地圖、照片、旅記、指南、優惠券、天氣、分帳與同步介面。
- 原楓葉元件與偏好保留，調整葉片色彩與線條；另提供預設關閉的「繪本飄雪」，偏好獨立保存。`prefers-reduced-motion` 停止狐狸、雲朵、日期彈跳、楓葉與飄雪；頁面隱藏時暫停飄落效果，開啟對話框時隱藏飄落效果。
- Google Fonts Huninn 官方原始字型由網站本身提供：`public/fonts/Huninn-Regular.ttf`，授權於同資料夾 `Huninn-OFL.txt`。使用 font-display swap 與中文字型備援；PWA 將字型納入離線快取，免安裝 HTML 內嵌字型。
- PWA 圖示更新為原創狐狸手帳 SVG，PNG 由 `npm run icons:generate` 產生；Safari 既有主畫面圖示可能不立即刷新。

主題：`src/styles/storybook.css`、`src/styles/tokens.css`。插圖：`src/components/SendaiStory.tsx`。航班：`FlightCards.tsx`。飄雪：`Snowflakes.tsx`。

驗證：TypeScript、正式建置、52 項單元測試；51 項一般手機／桌面瀏覽器測試（1 項桌面不適用略過）、8 項網站子路徑、6 項原生 service worker／離線更新、1 項免安裝 HTML、10 項分帳及 8 項購物 API／WebSocket 契約案例。購物雙裝置案例在多組瀏覽器並跑時曾超過 30 秒，獨立重跑通過；同步測試使用明確 fixtures，並非正式 Supabase 實機驗收。

另以 Chromium 實際檢視 390px 手機首頁、時間軸、指南、天氣、分帳與 1440px 桌面。iPhone Safari、實際加入主畫面模式與正式 Supabase 兩支手機仍需實機確認，不能以模擬器結果取代。

發布後於原網站重新整理；看到「更新並重新載入」時，先儲存編輯再更新。不要清除網站資料。飄楓與飄雪開關位於頁尾。
