import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { BookOpen, CheckCheck, CloudSun, Download, Leaf, Luggage, ShieldCheck, Upload, Wallet, X } from 'lucide-react'
import type { AppData, Photo } from './types'
import { PLAN_REVISION } from './data/itinerary'
import { defaultDetails } from './data/guide'
import { freshData, upgradeLists, adoptFormalPlan } from './lib/migration'
import { changePhotos, getPhotos } from './lib/photos'
import { downloadJson, isAppData, makeBackup, parseBackup, readData, STORAGE_KEY } from './lib/storage'
import { beginLocalDataTask, localDataTaskActive } from './lib/local-task'
import Itinerary from './components/Itinerary'
import Guide from './components/Guide'
import Weather from './components/Weather'
import Expenses from './features/expenses/Expenses'
import Modal from './components/Modal'
import TripHeader from './components/TripHeader'
import { PwaHelp, PwaNotice } from './components/PwaTools'
import { usePwa } from './lib/pwa'
import MapleLeaves from './components/MapleLeaves'
import { useEffect } from 'react'
import { tripStatus } from './lib/dates'
import type { LocationKey } from './lib/weather'

const initial: AppData = freshData(defaultDetails)
type Tab = 'itinerary' | 'guide' | 'weather' | 'expenses'
function currentTab(): Tab { const hash = location.hash.slice(1).split('?')[0]; if (hash==='itinerary'||hash==='guide'||hash==='weather'||hash==='expenses') return hash; const q=new URLSearchParams(location.search); return q.has('join')?'expenses':'itinerary' }
export default function App() {
  const [loaded] = useState(() => readData(initial))
  const [data, setData] = useState(() => upgradeLists(loaded.data))
  const dataRef = useRef(data); dataRef.current = data
  const [saveBlocked, setSaveBlocked] = useState(!!loaded.error)
  const [saveError, setSaveError] = useState(loaded.error)
  const [tab, setTab] = useState<Tab>(currentTab)
  const tabRef = useRef(tab)
  const scrollPositions = useRef<Record<Tab, number>>({ itinerary: 0, guide: 0, weather: 0, expenses: 0 })
  const [activeDay, setActiveDay] = useState(1)
  const [weatherLocation, setWeatherLocation] = useState<LocationKey>('sendai')
  const [photos, setPhotos] = useState<Photo[]>([])
  const pwa = usePwa()
  const [pwaHelpOpen, setPwaHelpOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [updatingPlan, setUpdatingPlan] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState(tripStatus)
  const report = useCallback((m: string) => setMessage(m), [])
  const reloadPhotos = useCallback(async () => { setPhotos(await getPhotos()) }, [])
  useEffect(() => { void reloadPhotos().catch(e => report((e as Error).message)); const listener = () => { const next = currentTab(); if (next !== tabRef.current) { scrollPositions.current[tabRef.current] = window.scrollY; tabRef.current = next; setTab(next) } }; window.addEventListener('hashchange', listener); const timer = setInterval(() => setStatus(tripStatus()), 60000); return () => { window.removeEventListener('hashchange', listener); clearInterval(timer) } }, [reloadPhotos, report])
  useLayoutEffect(() => { window.scrollTo({ top: scrollPositions.current[tab], behavior: 'instant' }) }, [tab])
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 9000); return () => clearTimeout(timer) }, [message])
  function commit(next: AppData) {
    if (localDataTaskActive()) { report('資料正在備份、更新或還原，請稍候完成。'); return }
    if (!isAppData(next)) { setSaveError('這次修改超過資料容量或格式限制，原有資料未變更。請先匯出備份並減少項目後再試。'); return }
    dataRef.current=next; setData(next)
    if (saveBlocked) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSaveError('') } catch { setSaveError('裝置儲存失敗。目前修改仍在此頁，請立即匯出備份，避免關閉後遺失。') }
  }
  async function exportBackup() {
    let release: (() => void) | undefined
    try { release = beginLocalDataTask() } catch (e) { report((e as Error).message); return }
    setBusy(true)
    try { downloadJson(await makeBackup(dataRef.current, await getPhotos()), `仙台旅行備份-${new Date().toISOString().slice(0,10)}.json`); report('備份已產生，包含行程、清單、旅行資料與照片。') } catch (e) { report(`匯出失敗：${(e as Error).message}`) } finally { release(); setBusy(false) }
  }
  function assertUnchanged(snapshot: AppData, stored: string | null) {
    if (snapshot !== dataRef.current) throw new Error('準備期間資料已有修改，這次不會覆寫，請重新操作。')
    if (localStorage.getItem(STORAGE_KEY) !== stored) {
      setSaveBlocked(true); setSaveError('另一個分頁已修改資料，已暫停此頁保存。請先備份目前內容，再重新整理取得最新資料。')
      throw new Error('另一個分頁已修改資料，原有修改未被覆寫。')
    }
  }
  async function importBackup(file?: File) {
    if (!file) return
    if (file.size > 100 * 1024 * 1024) { report('備份超過 100 MB，請選擇較小的檔案。'); return }
    let release: (() => void) | undefined
    try { release = beginLocalDataTask() } catch (e) { report((e as Error).message); return }
    setBusy(true)
    try {
      const snapshot = dataRef.current, stored = localStorage.getItem(STORAGE_KEY)
      const parsed = await parseBackup(await file.text())
      assertUnchanged(snapshot, stored)
      if (!confirm(`以備份取代所有資料？將匯入 ${parsed.data.stops.length} 筆行程、${parsed.data.packing.length} 項清單、${parsed.photos.length} 張照片。建議先匯出目前資料。`)) return
      const oldPhotos = await getPhotos()
      assertUnchanged(snapshot, stored)
      const restored = upgradeLists(parsed.data)
      if (!isAppData(restored)) throw new Error('匯入資料超過容量或格式限制，原有資料未變更。')
      await changePhotos(parsed.photos, [], true)
      try { assertUnchanged(snapshot, stored); localStorage.setItem(STORAGE_KEY, JSON.stringify(restored)) }
      catch (error) {
        const previousIds = new Set(oldPhotos.map(p => p.id))
        await changePhotos(oldPhotos, parsed.photos.filter(p => !previousIds.has(p.id)).map(p => p.id))
        throw new Error(`還原未完成，原有照片已保留：${(error as Error).message}`)
      }
      dataRef.current=restored; setData(restored); setPhotos(parsed.photos); setSaveBlocked(false); setSaveError(''); setBackupOpen(false); report('備份已成功還原。')
    } catch (e) { report(`匯入失敗：${(e as Error).message}`) } finally { release(); setBusy(false) }
  }
  async function updatePlan() {
    if (saveBlocked || busy || updatingPlan) return
    if (!confirm('先下載包含照片的目前完整備份，再載入 11/10 正式行程。原行程、旅記、照片與勾選會保留於「舊行程存檔」，不覆寫原內容。確定更新？')) return
    let release: (() => void) | undefined
    try { release = beginLocalDataTask() } catch (e) { report((e as Error).message); return }
    setUpdatingPlan(true)
    try {
      const snapshot = dataRef.current, stored = localStorage.getItem(STORAGE_KEY)
      const next = adoptFormalPlan(snapshot)
      if (!isAppData(next)) throw new Error('正式行程超過資料容量限制，原有資料未變更。')
      const backup = await makeBackup(snapshot, await getPhotos())
      assertUnchanged(snapshot, stored)
      downloadJson(backup, '仙台更新前完整備份.json')
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      dataRef.current=next; setData(next); setSaveError(''); report('正式行程已載入；原資料保留於各日的舊行程存檔。')
    } catch (e) { report(`更新未完成，原有資料保留：${(e as Error).message}`) }
    finally { release(); setUpdatingPlan(false) }
  }
  return <><div inert={busy || updatingPlan} aria-busy={busy || updatingPlan}><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>跳至主要內容</a><header className="site-header"><a href="#itinerary" className="brand"><span className="brand-mark"><Leaf size={23} strokeWidth={1.5}/></span><span>SENDAI<span className="brand-sub">旅の手帖</span></span></a><div className="header-right"><span className="saved-indicator"><span className={saveError ? 'unsaved-dot' : 'saved-dot'}/>{saveError ? '請備份資料' : '行程儲存於此裝置'}</span><button className="backup-button" onClick={() => setBackupOpen(true)}><Download size={16}/><span>資料備份</span></button></div></header>
    <main id="main-content" tabIndex={-1} className={`app-shell tab-${tab}`}><TripHeader compact={tab !== 'itinerary'} status={status} hotel={data.details.hotel}/>
    <PwaNotice state={pwa} hideOffline={tab === 'expenses'}/>
    {tab === 'itinerary' && data.planRevision !== PLAN_REVISION && !data.planUpdateDismissed && <section className="notice plan-update" aria-label="正式行程更新"><h3>11/10 正式行程已準備好</h3><p>目前保留你的舊行程。更新會先下載完整備份，舊筆記、照片與勾選會留在存檔，不直接覆寫。</p><div className="button-row"><button className="button primary" disabled={saveBlocked || busy || updatingPlan} onClick={() => void updatePlan()}>{updatingPlan?'備份中…':'更新為正式行程並保留舊資料'}</button><button className="text-button" onClick={() => commit({...data,planUpdateDismissed:true})}>先保留目前行程</button></div></section>}
    {saveError && <div className="storage-error" role="alert"><strong>資料保存提醒</strong><p>{saveError}</p>{saveBlocked && <button className="button" onClick={() => { try { const raw = localStorage.getItem(STORAGE_KEY); downloadJson({ raw }, '仙台原始資料救援.json') } catch { report('無法讀取儲存空間，請檢查瀏覽器權限。') } }}>匯出原始資料救援檔</button>}<button className="button" onClick={() => setBackupOpen(true)}>開啟備份工具</button></div>}
    <div key={tab} className="page-enter">{tab === 'itinerary' ? <Itinerary stops={data.stops} setStops={change => { const stops = typeof change === 'function' ? change(dataRef.current.stops) : change; commit({ ...dataRef.current, stops }) }} photos={photos} reloadPhotos={reloadPhotos} activeDay={activeDay} setActiveDay={setActiveDay} day4Plan={data.day4Plan??'A'} setDay4Plan={day4Plan=>commit({...data,day4Plan})} formal={data.planRevision===PLAN_REVISION} report={report}/> : tab === 'guide' ? <Guide packing={data.packing} setPacking={packing => commit({ ...dataRef.current, packing })} shopping={data.shopping!} setShopping={shopping=>commit({...dataRef.current,shopping})} cloudTrip={data.shoppingCloudTrip} setCloudTrip={shoppingCloudTrip=>commit({...dataRef.current,shoppingCloudTrip})} details={data.details} setDetails={details => commit({ ...dataRef.current, details })}/> : tab === 'weather' ? <Weather location={weatherLocation} setLocation={setWeatherLocation}/> : <Expenses/>}</div>
    <footer className="site-footer"><MapleLeaves/><Leaf size={15}/><span>好好旅行，也好好記得。</span><small>SENDAI TRAVEL JOURNAL · 2026</small><button className="text-button pwa-help-trigger" onClick={() => setPwaHelpOpen(true)}>加入主畫面與離線使用</button></footer></main>
    <nav className="bottom-nav" aria-label="主導覽">{([{ id: 'itinerary', label: '行程', en: 'Itinerary', icon: BookOpen }, { id: 'guide', label: '指南', en: 'Guide', icon: Luggage }, { id: 'weather', label: '天氣', en: 'Weather', icon: CloudSun }, { id: 'expenses', label: '分帳', en: 'Expenses', icon: Wallet }] as const).map(item => <a key={item.id} href={`#${item.id}`} aria-label={`${item.label} ${item.en}`} aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'active' : ''}><item.icon size={21} strokeWidth={tab === item.id ? 2 : 1.6} aria-hidden="true"/><span>{item.label}</span></a>)}</nav>
    {message && !backupOpen && <div className="toast" role="status"><CheckCheck size={18}/><span>{message}</span><button aria-label="關閉通知" onClick={() => setMessage('')}><X size={16}/></button></div>}
    {pwaHelpOpen && <PwaHelp state={pwa} onClose={() => setPwaHelpOpen(false)}/>}</div>
    {(busy || updatingPlan) && <div role="status" className="local-task-status">{updatingPlan?'正在備份與更新行程，請稍候完成。':'正在處理完整備份，請稍候完成。'}</div>}
    {backupOpen && <Modal title="把回憶好好保存" onClose={() => { if (!busy && !updatingPlan) setBackupOpen(false) }}><div className="backup-content">{message && <p className="backup-status" role="status">{message}</p>}<ShieldCheck size={38}/>{data.planRevision !== PLAN_REVISION && <button className="button" disabled={saveBlocked || busy || updatingPlan} onClick={() => void updatePlan()}>載入最新正式行程（先備份）</button>}<p>行程、清單與筆記只保存在此瀏覽器；照片使用 IndexedDB。清除瀏覽器資料或更換裝置前，請下載完整備份。</p><button className="button primary" disabled={busy || updatingPlan} onClick={() => void exportBackup()}><Download size={17}/>{busy ? '處理中…' : '匯出完整 JSON 備份'}</button><label className={`button ${busy || updatingPlan ? 'disabled' : ''}`}><Upload size={17}/>匯入 JSON 備份<input type="file" accept=".json,application/json" hidden disabled={busy || updatingPlan} onChange={e => { void importBackup(e.target.files?.[0]); e.target.value = '' }}/></label><p className="muted small">匯入會先驗證格式並詢問確認，再取代目前資料。檔案上限 100 MB。此 JSON 不含雲端帳務；帳務請在分帳頁另行匯出 CSV。備份可能含私人旅記，請自行妥善保管。無需登入、不會上傳照片。</p></div></Modal>}
  </>
}
