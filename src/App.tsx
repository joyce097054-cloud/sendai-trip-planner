import { useCallback, useState } from 'react'
import { BookOpen, CheckCheck, CloudSun, Download, Leaf, Luggage, MapPin, ShieldCheck, Upload, Wallet, X } from 'lucide-react'
import type { AppData, Photo } from './types'
import { defaultStops } from './data/itinerary'
import { defaultDetails, defaultPacking } from './data/guide'
import { changePhotos, getPhotos } from './lib/photos'
import { downloadJson, makeBackup, parseBackup, readData, STORAGE_KEY } from './lib/storage'
import Itinerary from './components/Itinerary'
import Guide from './components/Guide'
import Weather from './components/Weather'
import Expenses from './features/expenses/Expenses'
import Modal from './components/Modal'
import { useEffect } from 'react'
import { tripStatus } from './lib/dates'

const initial: AppData = { version: 1, stops: defaultStops, packing: defaultPacking, details: defaultDetails }
type Tab = 'itinerary' | 'guide' | 'weather' | 'expenses'
function currentTab(): Tab { const hash = location.hash.slice(1); if (hash==='itinerary'||hash==='guide'||hash==='weather'||hash==='expenses') return hash; const q=new URLSearchParams(location.search); return q.has('code')||q.has('join')||q.has('error')||new URLSearchParams(hash).has('error_description')?'expenses':'itinerary' }
export default function App() {
  const [loaded] = useState(() => readData(initial))
  const [data, setData] = useState(loaded.data)
  const [saveBlocked, setSaveBlocked] = useState(!!loaded.error)
  const [saveError, setSaveError] = useState(loaded.error)
  const [tab, setTab] = useState<Tab>(currentTab)
  const [activeDay, setActiveDay] = useState(1)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [backupOpen, setBackupOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState(tripStatus)
  const report = useCallback((m: string) => setMessage(m), [])
  const reloadPhotos = useCallback(async () => { setPhotos(await getPhotos()) }, [])
  useEffect(() => { void reloadPhotos().catch(e => report((e as Error).message)); const listener = () => setTab(currentTab()); window.addEventListener('hashchange', listener); const timer = setInterval(() => setStatus(tripStatus()), 60000); return () => { window.removeEventListener('hashchange', listener); clearInterval(timer) } }, [reloadPhotos, report])
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 9000); return () => clearTimeout(timer) }, [message])
  function commit(next: AppData) {
    setData(next)
    if (saveBlocked) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSaveError('') } catch { setSaveError('裝置儲存失敗。目前修改仍在此頁，請立即匯出備份，避免關閉後遺失。') }
  }
  async function exportBackup() {
    setBusy(true)
    try { downloadJson(await makeBackup(data, await getPhotos()), `仙台旅行備份-${new Date().toISOString().slice(0,10)}.json`); report('備份已產生，包含行程、清單、旅行資料與照片。') } catch (e) { report(`匯出失敗：${(e as Error).message}`) } finally { setBusy(false) }
  }
  async function importBackup(file?: File) {
    if (!file) return
    if (file.size > 100 * 1024 * 1024) { report('備份超過 100 MB，請選擇較小的檔案。'); return }
    setBusy(true)
    try {
      const parsed = await parseBackup(await file.text())
      if (!confirm(`以備份取代所有資料？將匯入 ${parsed.data.stops.length} 筆行程、${parsed.data.packing.length} 項清單、${parsed.photos.length} 張照片。建議先匯出目前資料。`)) return
      const oldPhotos = await getPhotos()
      await changePhotos(parsed.photos, [], true)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data)) } catch { await changePhotos(oldPhotos, [], true); throw new Error('裝置空間不足，已保留原有資料。') }
      setData(parsed.data); setPhotos(parsed.photos); setSaveBlocked(false); setSaveError(''); setBackupOpen(false); report('備份已成功還原。')
    } catch (e) { report(`匯入失敗：${(e as Error).message}`) } finally { setBusy(false) }
  }
  return <><header className="site-header"><a href="#itinerary" className="brand"><span className="brand-mark"><Leaf size={23} strokeWidth={1.5}/></span><span>SENDAI<span className="brand-sub">旅の手帖</span></span></a><div className="header-right"><span className="saved-indicator"><span className={saveError ? 'unsaved-dot' : 'saved-dot'}/>{saveError ? '請備份資料' : '儲存於此裝置'}</span><button className="backup-button" onClick={() => setBackupOpen(true)}><Download size={16}/><span>資料備份</span></button></div></header>
    <main className="app-shell"><section className="hero"><div className="hero-copy"><span className="hero-kicker">MIYAGI, JAPAN / AUTUMN 2026</span><h1>仙台賞楓<br/>五日自由行<span className="hero-dot">。</span></h1><p>把日子放慢，把秋色裝進行李。</p><div className="hero-date"><span>2026.11.20 — 11.24</span><span className="hero-days">5 DAYS</span></div><span className="countdown"><span/>{status}</span></div><img className="hero-art" src="sendai-autumn.svg" alt="仙台秋日插畫：暖橘楓葉、山巒與日式庭園"/><div className="hero-stamp" aria-hidden="true">仙<br/>台<span>秋の旅</span></div></section>
    <div className="trip-strip"><span><MapPin size={15}/> 仙台・松島・岩沼</span><span><Luggage size={15}/><span className="strip-hotel">{data.details.hotel}</span></span><span className="desktop-only"><Leaf size={15}/> 大眾運輸 × 步行</span></div>
    {saveError && <div className="storage-error" role="alert"><strong>資料保存提醒</strong><p>{saveError}</p>{saveBlocked && <button className="button" onClick={() => { try { const raw = localStorage.getItem(STORAGE_KEY); downloadJson({ raw }, '仙台原始資料救援.json') } catch { report('無法讀取儲存空間，請檢查瀏覽器權限。') } }}>匯出原始資料救援檔</button>}<button className="button" onClick={() => setBackupOpen(true)}>開啟備份工具</button></div>}
    <div key={tab} className="page-enter">{tab === 'itinerary' ? <Itinerary stops={data.stops} setStops={stops => commit({ ...data, stops })} photos={photos} reloadPhotos={reloadPhotos} activeDay={activeDay} setActiveDay={setActiveDay} report={report}/> : tab === 'guide' ? <Guide packing={data.packing} setPacking={packing => commit({ ...data, packing })} details={data.details} setDetails={details => commit({ ...data, details })}/> : tab === 'weather' ? <Weather/> : <Expenses/>}</div>
    <footer className="site-footer"><Leaf size={15}/><span>好好旅行，也好好記得。</span><small>SENDAI TRAVEL JOURNAL · 2026</small></footer></main>
    <nav className="bottom-nav" aria-label="主導覽">{([{ id: 'itinerary', label: '行程', en: 'Itinerary', icon: BookOpen }, { id: 'guide', label: '指南', en: 'Guide', icon: Luggage }, { id: 'weather', label: '天氣', en: 'Weather', icon: CloudSun }, { id: 'expenses', label: '分帳', en: 'Expenses', icon: Wallet }] as const).map(item => <a key={item.id} href={`#${item.id}`} aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'active' : ''}><item.icon size={21} strokeWidth={tab === item.id ? 2 : 1.6}/><span>{item.label}<small>{item.en}</small></span></a>)}</nav>
    {message && !backupOpen && <div className="toast" role="status"><CheckCheck size={18}/><span>{message}</span><button aria-label="關閉通知" onClick={() => setMessage('')}><X size={16}/></button></div>}
    {backupOpen && <Modal title="把回憶好好保存" onClose={() => { if (!busy) setBackupOpen(false) }}><div className="backup-content">{message && <p className="backup-status" role="status">{message}</p>}<ShieldCheck size={38}/><p>行程、清單與筆記只保存在此瀏覽器；照片使用 IndexedDB。清除瀏覽器資料或更換裝置前，請下載完整備份。</p><button className="button primary" disabled={busy} onClick={() => void exportBackup()}><Download size={17}/>{busy ? '處理中…' : '匯出完整 JSON 備份'}</button><label className={`button ${busy ? 'disabled' : ''}`}><Upload size={17}/>匯入 JSON 備份<input type="file" accept=".json,application/json" hidden disabled={busy} onChange={e => { void importBackup(e.target.files?.[0]); e.target.value = '' }}/></label><p className="muted small">匯入會先驗證格式並詢問確認，再取代目前資料。檔案上限 100 MB。此 JSON 不含雲端帳務；帳務請在分帳頁另行匯出 CSV。備份可能含私人旅記，請自行妥善保管。無需登入、不會上傳照片。</p></div></Modal>}
  </>
}
