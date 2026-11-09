import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import type { PwaState } from '../lib/pwa'
import Modal from './Modal'

export function PwaNotice({ state, hideOffline }: { state: PwaState; hideOffline: boolean }) {
  const [dismissed, setDismissed] = useState<ServiceWorker | null>(null)
  return <div className="pwa-notices">
    {!state.online && !hideOffline && <div className="notice pwa-offline" role="status"><WifiOff size={18} aria-hidden="true"/><p>目前離線。已開啟的行程與清單可繼續編輯；天氣與雲端分帳需連線。</p></div>}
    {state.waiting && dismissed !== state.waiting && <div className="notice pwa-update" role="status"><p>新版已下載。請先儲存編輯中的內容，再重新載入。</p><div className="button-row"><button className="button" onClick={state.applyUpdate}><RefreshCw size={16} aria-hidden="true"/>更新並重新載入</button><button className="text-button" onClick={() => setDismissed(state.waiting)}>稍後再說</button></div></div>}
  </div>
}

export function PwaHelp({ state, onClose }: { state: PwaState; onClose: () => void }) {
  useEffect(() => { void state.verifyOffline() }, [])
  const status = {
    checking: '正在準備離線內容，請保持連線片刻。',
    ready: '離線內容已準備完成，重新開啟時也可使用行程、清單與專案內指南圖片。',
    unavailable: '目前瀏覽器尚無法準備離線內容；請以 Safari 開啟正式 HTTPS 網站。',
    error: '離線內容尚未準備完成。仍可連線使用，請稍後檢查更新或重新開啟網站。',
    development: '這是開發預覽，尚未啟用離線快取。正式 HTTPS 版本才會準備離線內容。',
    portable: '這是電腦單檔版，內容已包含在檔案中。手機加入主畫面請使用正式 HTTPS 網址。',
  }[state.offlineState]
  return <Modal title="加入主畫面與離線使用" onClose={onClose}><div className="form-stack pwa-help">
    <p>{state.installed ? '目前以主畫面模式開啟。' : '目前以瀏覽器模式開啟。'}</p>
    <p className="notice" role="status" data-pwa-state={state.offlineState} data-pwa-version={state.version}>{status}</p>
    <h3>iPhone 加入主畫面</h3><ol><li>使用 Safari 開啟這個網站。</li><li>點 Safari 的「分享」。</li><li>選「加入主畫面」，確認名稱後點「加入」。</li><li>從主畫面的「仙台手帳」圖示重新開啟。</li></ol>
    <p className="muted small">不同 iOS 版本的分享按鈕位置可能不同。首次開啟與離線內容下載仍需網路；安裝本身不代表已下載完成。</p>
    <h3>帳本與資料保存</h3><p>天氣和共同帳務需要網路。分帳離線時無法送出，恢復連線後會重新讀取最新資料。</p>
    <p>Safari 與主畫面版本的儲存空間可能不同。若沒有自動開啟原帳本，請在分帳頁貼上原私人旅程連結；不用註冊，也不需要刪除原帳本。</p>
    <p className="muted small">個人行程、清單與照片請在各自使用的模式匯出完整 JSON 備份。共同帳務以 Supabase 為準，可另外匯出 CSV。更新網站不會清除上述資料。</p>
    {state.waiting && <button className="button" onClick={() => { onClose(); state.applyUpdate() }}>更新並重新載入</button>}
    {state.offlineState === 'error' && <button className="button" disabled={state.checking || !state.online} onClick={() => void state.prepareOffline()}>重新準備離線內容</button>}
    {state.offlineState !== 'development' && state.offlineState !== 'portable' && state.offlineState !== 'unavailable' && <button className="button" disabled={state.checking || !state.online} onClick={() => void state.checkUpdate()}><RefreshCw size={16} aria-hidden="true"/>{state.checking ? '檢查中…' : '檢查更新'}</button>}
    {state.message && <p role="status" className="muted small">{state.message}</p>}
  </div></Modal>
}
