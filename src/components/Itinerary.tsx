import { useState } from 'react'
import { ArrowUpRight, ChevronDown, MapPin, Plus, Route } from 'lucide-react'
import type { Stop, Photo, Category } from '../types'
import { days } from '../data/itinerary'
import { mapUrl } from '../lib/maps'
import { compressPhoto, changePhotos } from '../lib/photos'
import Modal from './Modal'
import ItineraryStop from './ItineraryStop'

function StopForm({ stop, onSave, onClose }: { stop: Stop; onSave: (s: Stop) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(stop)
  const field = (key: keyof Stop, value: unknown) => setDraft(s => ({ ...s, [key]: value }))
  return <Modal title={stop.name ? '編輯這段旅程' : '加入新的回憶'} onClose={onClose}><form onSubmit={e => { e.preventDefault(); if (!draft.name.trim()) return; if (draft.start && draft.end && draft.end < draft.start) { alert('結束時間不可早於開始時間。'); return }; onSave({ ...draft, name: draft.name.trim(), mapQuery: draft.mapQuery.trim() || draft.name.trim() }) }} className="form-stack">
    <div className="field-row"><label className="field">日期<select value={draft.day} onChange={e => field('day', Number(e.target.value))}>{days.map(d => <option key={d.day} value={d.day}>Day {d.day}・{d.date.slice(5)}</option>)}</select></label><label className="field">分類<select value={draft.category} onChange={e => field('category', e.target.value)}>{(['美食','活動','購物','景點','住宿','交通'] as Category[]).map(c => <option key={c}>{c}</option>)}</select></label></div>
    <div className="field-row"><label className="field">開始時間<input type="time" value={draft.start} onChange={e => field('start', e.target.value)}/></label><label className="field">結束時間<input type="time" value={draft.end} onChange={e => field('end', e.target.value)}/></label></div>
    <label className="field">景點名稱<input autoFocus required maxLength={200} value={draft.name} onChange={e => field('name', e.target.value)}/></label>
    <label className="field">日文名稱<input maxLength={200} value={draft.japanese} onChange={e => field('japanese', e.target.value)}/></label>
    <label className="field">簡短介紹<textarea value={draft.description} maxLength={2000} onChange={e => field('description', e.target.value)}/></label>
    <div className="field-row"><label className="field">建議停留<input value={draft.duration} maxLength={200} onChange={e => field('duration', e.target.value)}/></label><label className="field">推薦標籤<input placeholder="必吃、必買、必拍" value={draft.tags.join('、')} onChange={e => field('tags', e.target.value.split(/[、,，]/).filter(Boolean))}/></label></div>
    <label className="field">交通方式與預估時間<input value={draft.transport} maxLength={500} onChange={e => field('transport', e.target.value)}/></label>
    <label className="field">Google Maps 搜尋地點<input value={draft.mapQuery} maxLength={500} placeholder="景點名稱＋城市" onChange={e => field('mapQuery', e.target.value)}/></label>
    <label className="field">拍照小技巧<input value={draft.photoTip} maxLength={500} onChange={e => field('photoTip', e.target.value)}/></label>
    <label className="field">備註／旅遊筆記<textarea maxLength={20000} value={draft.notes} onChange={e => field('notes', e.target.value)}/></label>
    <p className="muted small">順序依手動排列保留，修改時間後可使用「依時間排序」。</p><button className="button primary" type="submit">儲存行程</button>
  </form></Modal>
}
export default function Itinerary({ stops, setStops, photos, reloadPhotos, activeDay, setActiveDay, report }: { stops: Stop[]; setStops: (s: Stop[]) => void; photos: Photo[]; reloadPhotos: () => Promise<void>; activeDay: number; setActiveDay: (day: number) => void; report: (message: string) => void }) {
  const [editing, setEditing] = useState<Stop | null>(null)
  const [routeOpen, setRouteOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const day = days[activeDay - 1]
  const list = stops.filter(s => s.day === activeDay)
  const completed = list.filter(s => s.done).length
  function update(stop: Stop) { setStops(stops.map(s => s.id === stop.id ? stop : s)) }
  function move(stop: Stop, offset: number) {
    const target = list[list.indexOf(stop) + offset]; if (!target) return
    const next = [...stops], a = next.indexOf(stop), b = next.indexOf(target)
    ;[next[a], next[b]] = [next[b], next[a]]; setStops(next)
  }
  async function remove(stop: Stop) {
    if (!confirm(`刪除「${stop.name}」及其照片？此操作無法復原。`)) return
    try { await changePhotos([], photos.filter(p => p.stopId === stop.id).map(p => p.id)); setStops(stops.filter(s => s.id !== stop.id)); await reloadPhotos() } catch (e) { report((e as Error).message) }
  }
  async function upload(stop: Stop, files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try { const entries = await Promise.all(Array.from(files).map(async file => ({ id: crypto.randomUUID(), stopId: stop.id, caption: file.name, blob: await compressPhoto(file) }))); await changePhotos(entries); await reloadPhotos(); report('照片已儲存在此裝置，記得定期匯出備份。') } catch (e) { report((e as Error).message) } finally { setUploading(false) }
  }
  return <div className="page-content">
    <div className="itinerary-index"><h2>五日行程</h2><span className="muted small">按日期翻閱旅程</span></div>
    <div className="day-tabs" aria-label="選擇行程日期">{days.map(d => <button key={d.day} aria-pressed={d.day === activeDay} className={d.day === activeDay ? 'active' : ''} onClick={() => { setActiveDay(d.day); document.querySelector('.day-summary')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }) }}><span>DAY {d.day}</span><strong>{d.date.slice(5).replace('-', '.')}</strong><small>週{d.weekday}</small></button>)}</div>
    <section className="day-summary"><time className="day-date" dateTime={day.date}><strong>{day.date.slice(-2)}</strong><span>11 月 · 週{day.weekday}</span></time><div className="day-topic"><h2>{day.title}</h2><p><MapPin size={15} aria-hidden="true"/>{day.area}</p></div><div className="day-progress"><span>今日進度</span><strong>{completed}<span> / {list.length}</span></strong><progress aria-label="當日行程完成比例" value={completed} max={list.length || 1}/></div></section>
    <div className="itinerary-layout"><div><div className="section-heading timeline-heading"><h3><Route size={18}/> 今日散策路線 <span className="muted small">{list.length} 個安排</span></h3><button className="text-button" onClick={() => setRouteOpen(!routeOpen)} aria-expanded={routeOpen}>路線總覽 <ChevronDown size={14}/></button></div>
    {routeOpen && <section className="panel route-panel"><h3>依行程順序出發</h3><p className="muted small">Google Maps 大眾運輸不支援多站路線，請逐段開啟；實際班次與地點請出發前確認。</p><ol>{list.map((s, i) => <li key={s.id}><a href={mapUrl(s.mapQuery || s.name)} target="_blank" rel="noreferrer">{s.name} <ArrowUpRight size={13}/></a>{i > 0 && <a className="small" href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(list[i-1].mapQuery || list[i-1].name)}&destination=${encodeURIComponent(s.mapQuery || s.name)}&travelmode=transit`} target="_blank" rel="noreferrer">上一站 → 此站</a>}</li>)}</ol></section>}
    <div className="timeline">{list.map((stop, index) => <ItineraryStop key={stop.id} stop={stop} index={index} total={list.length} photos={photos.filter(p => p.stopId === stop.id)} uploading={uploading} onMove={offset => move(stop, offset)} onEdit={() => setEditing(stop)} onToggle={() => update({ ...stop, done: !stop.done })} onNotes={notes => update({ ...stop, notes })} onRemove={() => void remove(stop)} onUpload={files => void upload(stop, files)} onDeletePhoto={async photo => { if (confirm('刪除此照片？')) { try { await changePhotos([], [photo.id]); await reloadPhotos() } catch (e) { report((e as Error).message) } } }}/>)}</div>
    {!list.length && <div className="panel empty"><MapPin/><h3>把這一天留給驚喜</h3><p>新增第一個想去的地方，開始安排旅程。</p></div>}
    <div className="timeline-controls"><button className="add-stop" onClick={() => setEditing({ id: crypto.randomUUID(), day: activeDay, start: '', end: '', name: '', japanese: '', category: '景點', description: '', duration: '', transport: '', tags: [], photoTip: '', notes: '', done: false, mapQuery: '' })}><Plus size={17}/> 新增一段旅程</button>{list.length > 1 && <button className="text-button small" onClick={() => { const sorted = [...list].sort((a,b) => (a.start || '99:99').localeCompare(b.start || '99:99')); let i = 0; setStops(stops.map(s => s.day === activeDay ? sorted[i++] : s)) }}>依時間排序</button>}</div>
    </div><aside className="day-aside"><section className="panel daily-reminder"><span className="eyebrow">A LITTLE NOTE</span><h3>當日旅遊小提醒</h3><div className="reminder-item"><span>01 / 穿著提案</span><p>{day.clothing}</p></div><div className="reminder-item"><span>02 / 賞楓筆記</span><p>{day.foliage}</p></div><div className="reminder-item"><span>03 / 出發前留意</span><p>{day.reminder}</p></div><div className="souvenir"><span>帶一點仙台回家</span><p>{day.souvenir}</p></div></section></aside></div>
    {editing && <StopForm stop={editing} onClose={() => setEditing(null)} onSave={s => { setStops(stops.some(x => x.id === s.id) ? stops.map(x => x.id === s.id ? s : x) : [...stops, s]); setActiveDay(s.day); setEditing(null); report('行程已更新') }}/>}</div>
}
