import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, Camera, Check, ChevronDown, Clock3, Edit3, Footprints, MapPin, Plus, Route, TrainFront, Trash2 } from 'lucide-react'
import type { Stop, Photo, Category } from '../types'
import { days } from '../data/itinerary'
import { directionUrl, mapUrl } from '../lib/maps'
import { compressPhoto, changePhotos } from '../lib/photos'
import Modal from './Modal'

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
function PhotoThumb({ photo, onDelete }: { photo: Photo; onDelete: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => { const u = URL.createObjectURL(photo.blob); setUrl(u); return () => URL.revokeObjectURL(u) }, [photo.blob])
  return <figure className="photo-thumb"><a href={url} target="_blank" rel="noreferrer" aria-label="開啟旅途照片"><img src={url} alt={photo.caption || '我的旅途照片'}/></a><button className="photo-delete icon-button" aria-label="刪除照片" onClick={onDelete}><Trash2 size={14}/></button><figcaption>{photo.caption}</figcaption></figure>
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
    <div className="section-heading page-heading"><div><span className="eyebrow">OUR LITTLE JOURNEY</span><h2>把秋天，慢慢收藏<span className="tiny-leaf">✧</span></h2></div><span className="pill desktop-only">5 DAYS IN SENDAI</span></div>
    <div className="day-tabs" aria-label="選擇行程日期">{days.map(d => <button key={d.day} aria-pressed={d.day === activeDay} className={d.day === activeDay ? 'active' : ''} onClick={() => setActiveDay(d.day)}><span>DAY {d.day}</span><strong>{d.date.slice(5).replace('-', '.')}</strong><small>週{d.weekday}</small></button>)}</div>
    <section className="day-summary"><div><div className="eyebrow">NOVEMBER {day.date.slice(-2)}, 2026 · 週{day.weekday}</div><h2>{day.title}</h2><p><MapPin size={14}/>{day.area}</p></div><div className="day-progress"><strong>{completed}<span> / {list.length}</span></strong><span className="small">今日已完成</span><progress value={completed} max={list.length || 1}/></div></section>
    <div className="itinerary-layout"><div><div className="section-heading timeline-heading"><h3><Route size={18}/> 今日散策路線 <span className="muted small">{list.length} 個安排</span></h3><button className="text-button" onClick={() => setRouteOpen(!routeOpen)} aria-expanded={routeOpen}>路線總覽 <ChevronDown size={14}/></button></div>
    {routeOpen && <section className="panel route-panel"><h3>依行程順序出發</h3><p className="muted small">Google Maps 大眾運輸不支援多站路線，請逐段開啟；實際班次與地點請出發前確認。</p><ol>{list.map((s, i) => <li key={s.id}><a href={mapUrl(s.mapQuery || s.name)} target="_blank" rel="noreferrer">{s.name} <ArrowUpRight size={13}/></a>{i > 0 && <a className="small" href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(list[i-1].mapQuery || list[i-1].name)}&destination=${encodeURIComponent(s.mapQuery || s.name)}&travelmode=transit`} target="_blank" rel="noreferrer">上一站 → 此站</a>}</li>)}</ol></section>}
    <div className="timeline">{list.map((stop, index) => <article className={`stop-row ${stop.done ? 'is-done' : ''}`} key={stop.id}><div className="time-rail"><strong>{stop.start || '彈性'}</strong><span>{stop.end}</span><i/></div><div className="stop-card"><div className="stop-topline"><span className={`category category-${stop.category}`}>{stop.category}</span><div className="stop-actions"><button className="icon-button" title="上移行程" aria-label={`上移 ${stop.name}`} disabled={index === 0} onClick={() => move(stop, -1)}><ArrowUp size={15}/></button><button className="icon-button" title="下移行程" aria-label={`下移 ${stop.name}`} disabled={index === list.length-1} onClick={() => move(stop, 1)}><ArrowDown size={15}/></button><button className="icon-button" aria-label={`編輯 ${stop.name}`} onClick={() => setEditing(stop)}><Edit3 size={15}/></button></div></div><div className="stop-title"><div><h3>{stop.name}</h3>{stop.japanese && <p className="japanese">{stop.japanese}</p>}</div><button className="complete-button" aria-label={`完成 ${stop.name}`} aria-pressed={stop.done} onClick={() => update({ ...stop, done: !stop.done })}>{stop.done && <Check size={17}/>}</button></div><p className="stop-description">{stop.description}</p><div className="stop-meta"><span><Clock3 size={13}/>{stop.duration || '停留時間自由安排'}</span>{stop.tags.map(t => <span key={t} className="tag">{t}</span>)}</div><div className="transport-line"><TrainFront size={14}/><span>{stop.transport || '交通待確認'}</span></div>
    <div className="stop-footer"><a className="map-link" href={directionUrl(stop.mapQuery || stop.name)} target="_blank" rel="noreferrer"><MapPin size={14}/> 地圖導航 <ArrowUpRight size={13}/></a><a className="walking-link" aria-label={`步行前往 ${stop.name}`} href={directionUrl(stop.mapQuery || stop.name, 'walking')} target="_blank" rel="noreferrer"><Footprints size={15}/>步行</a><details className="notes-details"><summary>旅記與照片</summary><div className="notes-body">{stop.photoTip && <p className="photo-tip"><Camera size={15}/>{stop.photoTip}</p>}<label className="field">我的旅行筆記<textarea aria-label={`${stop.name} 旅行筆記`} value={stop.notes} maxLength={20000} placeholder="記下一點小事，也是一段旅行。" onChange={e => update({ ...stop, notes: e.target.value })}/></label><label className={`button small ${uploading ? 'disabled' : ''}`}><Camera size={15}/>{uploading ? '儲存照片中…' : '加入照片'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={e => { void upload(stop, e.target.files); e.target.value = '' }} hidden/></label><div className="photo-grid">{photos.filter(p => p.stopId === stop.id).map(p => <PhotoThumb key={p.id} photo={p} onDelete={async () => { if (confirm('刪除此照片？')) { try { await changePhotos([], [p.id]); await reloadPhotos() } catch (e) { report((e as Error).message) } } }}/>)}</div><button className="text-button danger" onClick={() => void remove(stop)}><Trash2 size={14}/> 刪除此行程</button></div></details></div></div></article>)}</div>
    {!list.length && <div className="panel empty"><MapPin/><h3>把這一天留給驚喜</h3><p>新增第一個想去的地方，開始安排旅程。</p></div>}
    <div className="timeline-controls"><button className="add-stop" onClick={() => setEditing({ id: crypto.randomUUID(), day: activeDay, start: '', end: '', name: '', japanese: '', category: '景點', description: '', duration: '', transport: '', tags: [], photoTip: '', notes: '', done: false, mapQuery: '' })}><Plus size={17}/> 新增一段旅程</button>{list.length > 1 && <button className="text-button small" onClick={() => { const sorted = [...list].sort((a,b) => (a.start || '99:99').localeCompare(b.start || '99:99')); let i = 0; setStops(stops.map(s => s.day === activeDay ? sorted[i++] : s)) }}>依時間排序</button>}</div>
    </div><aside className="day-aside"><section className="panel daily-reminder"><span className="eyebrow">A LITTLE NOTE</span><h3>當日旅遊小提醒</h3><div className="reminder-item"><span>01 / 穿著提案</span><p>{day.clothing}</p></div><div className="reminder-item"><span>02 / 賞楓筆記</span><p>{day.foliage}</p></div><div className="reminder-item"><span>03 / 出發前留意</span><p>{day.reminder}</p></div><div className="souvenir"><span>帶一點仙台回家</span><p>{day.souvenir}</p></div></section><div className="quote-card"><span>旅の余白</span><p>不趕路，<br/>也能遇見風景。</p><small>TAKE YOUR TIME, MAKE MEMORIES.</small></div></aside></div>
    {editing && <StopForm stop={editing} onClose={() => setEditing(null)} onSave={s => { setStops(stops.some(x => x.id === s.id) ? stops.map(x => x.id === s.id ? s : x) : [...stops, s]); setActiveDay(s.day); setEditing(null); report('行程已更新') }}/>}</div>
}
