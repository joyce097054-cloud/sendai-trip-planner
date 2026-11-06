import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, Camera, Check, ChevronDown, Clock3, Edit3, Footprints, MapPin, Trash2 } from 'lucide-react'
import type { Photo, Stop } from '../types'
import { directionUrl } from '../lib/maps'

function usePhotoUrl(photo: Photo) {
  const [url, setUrl] = useState('')
  useEffect(() => { const value = URL.createObjectURL(photo.blob); setUrl(value); return () => URL.revokeObjectURL(value) }, [photo.blob])
  return url
}
function PhotoCover({ photo, name }: { photo: Photo; name: string }) {
  const url = usePhotoUrl(photo)
  return <img className="stop-photo-cover" src={url || undefined} alt={`${name} 的旅途照片`} loading="lazy"/>
}
function PhotoThumb({ photo, onDelete }: { photo: Photo; onDelete: () => void }) {
  const url = usePhotoUrl(photo)
  return <figure className="photo-thumb"><a href={url} target="_blank" rel="noreferrer" aria-label="開啟旅途照片"><img src={url || undefined} alt={photo.caption || '我的旅途照片'}/></a><button className="photo-delete icon-button" aria-label="刪除照片" onClick={onDelete}><Trash2 size={16} aria-hidden="true"/></button><figcaption>{photo.caption}</figcaption></figure>
}
interface Props {
  stop: Stop; index: number; total: number; photos: Photo[]; uploading: boolean;
  onMove: (offset: number) => void; onEdit: () => void; onToggle: () => void;
  onNotes: (notes: string) => void; onRemove: () => void;
  onUpload: (files: FileList | null) => void; onDeletePhoto: (photo: Photo) => void;
}
export default function ItineraryStop({ stop, index, total, photos, uploading, onMove, onEdit, onToggle, onNotes, onRemove, onUpload, onDeletePhoto }: Props) {
  return <article className={`stop-row ${stop.done ? 'is-done' : ''}`}>
    <div className="time-rail"><strong>{stop.start || '彈性'}</strong><span>{stop.end}</span><i aria-hidden="true"/></div>
    <div className="stop-card">
      <div className="stop-topline"><span className="category">{stop.category}</span><div className="stop-actions">
        <button className="icon-button" title="上移行程" aria-label={`上移 ${stop.name}`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={16} aria-hidden="true"/></button>
        <button className="icon-button" title="下移行程" aria-label={`下移 ${stop.name}`} disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown size={16} aria-hidden="true"/></button>
        <button className="icon-button" aria-label={`編輯 ${stop.name}`} onClick={onEdit}><Edit3 size={16} aria-hidden="true"/></button>
      </div></div>
      <div className="stop-title"><div><h3>{stop.name}</h3>{stop.japanese && <p className="japanese">{stop.japanese}</p>}</div><button className="complete-button" aria-label={`完成 ${stop.name}`} aria-pressed={stop.done} onClick={onToggle}><span>{stop.done && <Check size={17} aria-hidden="true"/>}</span></button></div>
      <div className="stop-meta"><span><Clock3 size={14} aria-hidden="true"/>{stop.duration || '停留時間自由安排'}</span>{stop.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}</div>
      {photos[0] && ['景點', '活動'].includes(stop.category) && <PhotoCover photo={photos[0]} name={stop.name}/>}
      <details className="stop-information"><summary>交通與景點資訊<ChevronDown size={15} aria-hidden="true"/></summary><div>
        <p className="stop-description">{stop.description || '還沒有景點介紹，可從編輯加入。'}</p>
        <dl className="stop-facts"><dt>交通</dt><dd>{stop.transport || '交通待確認'}</dd><dt>導航地點</dt><dd>{stop.mapQuery || stop.name}</dd></dl>
        <p className="muted small">詳細地址與入口待確認，導航前請核對分店及班次。</p>
      </div></details>
      <div className="stop-footer"><a className="map-link" href={directionUrl(stop.mapQuery || stop.name)} target="_blank" rel="noreferrer"><MapPin size={15} aria-hidden="true"/>地圖導航<ArrowUpRight size={13} aria-hidden="true"/></a><a className="walking-link" aria-label={`步行前往 ${stop.name}`} href={directionUrl(stop.mapQuery || stop.name, 'walking')} target="_blank" rel="noreferrer"><Footprints size={15} aria-hidden="true"/>步行</a></div>
      <details className="notes-details"><summary>旅記與照片<ChevronDown size={15} aria-hidden="true"/></summary><div className="notes-body">
        {stop.photoTip && <p className="photo-tip"><Camera size={16} aria-hidden="true"/>{stop.photoTip}</p>}
        <label className="field">我的旅行筆記<textarea aria-label={`${stop.name} 旅行筆記`} value={stop.notes} maxLength={20000} placeholder="記下一點小事，也是一段旅行。" onChange={e => onNotes(e.target.value)}/></label>
        <label className={`button ${uploading ? 'disabled' : ''}`}><Camera size={16} aria-hidden="true"/>{uploading ? '儲存照片中…' : '加入照片'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={e => { onUpload(e.target.files); e.target.value = '' }} hidden/></label>
        <div className="photo-grid">{photos.map(photo => <PhotoThumb key={photo.id} photo={photo} onDelete={() => onDeletePhoto(photo)}/>)}</div>
        <button className="text-button danger" onClick={onRemove}><Trash2 size={16} aria-hidden="true"/>刪除此行程</button>
      </div></details>
    </div>
  </article>
}
