import type { AppData, Photo, ShoppingItem } from '../types'
export const STORAGE_KEY = 'sendai-journal-v1'
const categories = ['美食', '活動', '購物', '景點', '住宿', '交通']
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) }
function string(v: unknown): v is string { return typeof v === 'string' && v.length <= 20000 }
function unique(items: { id: string }[]) { return new Set(items.map(i => i.id)).size === items.length }
export function isShoppingItem(v: unknown): v is ShoppingItem {
  return object(v) && string(v.id) && !!v.id && string(v.name) && !!v.name.trim() && (v.quantity === null || Number.isInteger(v.quantity) && Number(v.quantity) >= 1 && Number(v.quantity) <= 999) && string(v.shop) && string(v.notes) && typeof v.done === 'boolean'
}
export function isAppData(value: unknown): value is AppData {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.stops) || !Array.isArray(value.packing) || !object(value.details)) return false
  if (value.stops.length > 1000 || value.packing.length > 2000) return false
  if (value.listsRevision === 2 && value.shopping === undefined) return false
  if (value.planRevision !== undefined && !string(value.planRevision) || value.planUpdateDismissed !== undefined && typeof value.planUpdateDismissed !== 'boolean' || value.day4Plan !== undefined && !['A','B'].includes(String(value.day4Plan)) || value.listsRevision !== undefined && value.listsRevision !== 2 || value.shoppingCloudTrip !== undefined && (typeof value.shoppingCloudTrip !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.shoppingCloudTrip))) return false
  if (value.shopping !== undefined && (!object(value.shopping) || !['lan','treaty'].every(k => { const list = (value.shopping as Record<string,unknown>)[k]; return Array.isArray(list) && list.length <= 2000 && list.every(isShoppingItem) && unique(list) }))) return false
  const time = (v: unknown) => v === '' || typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
  return value.stops.every(s => object(s) && string(s.id) && !!s.id && Number.isInteger(s.day) && Number(s.day) >= 1 && Number(s.day) <= 5 && time(s.start) && time(s.end) && categories.includes(String(s.category)) && typeof s.done === 'boolean' && (s.variant === undefined || ['A','B'].includes(String(s.variant))) && (s.archived === undefined || typeof s.archived === 'boolean') && ['name','japanese','description','duration','transport','photoTip','notes','mapQuery'].every(k => string(s[k])) && !!s.name && Array.isArray(s.tags) && s.tags.length <= 20 && s.tags.every(string))
    && value.packing.every(p => object(p) && string(p.id) && !!p.id && string(p.group) && string(p.name) && !!p.name && Number.isInteger(p.quantity) && Number(p.quantity) >= 1 && Number(p.quantity) <= 999 && typeof p.done === 'boolean')
    && ['outbound','inbound','hotel','orderLink','notes'].every(k => string((value.details as Record<string, unknown>)[k]))
    && ['practicalNotes','hotelAddress','hotelPhone'].every(k => value.details && ((value.details as Record<string, unknown>)[k] === undefined || string((value.details as Record<string, unknown>)[k])))
    && unique(value.stops) && unique(value.packing)
}
export function readData(fallback: AppData): { data: AppData; error: string } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { data: fallback, error: '' }
    const parsed: unknown = JSON.parse(stored)
    if (!isAppData(parsed)) throw new Error()
    return { data: parsed, error: '' }
  } catch { return { data: fallback, error: '無法讀取已存資料。為避免覆蓋原始內容，已暫停自動儲存；請先匯出原始資料或匯入有效備份。' } }
}
interface Backup { format: 'sendai-trip-backup'; version: 1; exportedAt: string; data: AppData; photos: { id: string; stopId: string; caption: string; dataUrl: string }[] }
function asDataUrl(blob: Blob): Promise<string> { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('照片備份失敗')); r.readAsDataURL(blob) }) }
export async function makeBackup(data: AppData, photos: Photo[]): Promise<Backup> {
  return { format: 'sendai-trip-backup', version: 1, exportedAt: new Date().toISOString(), data, photos: await Promise.all(photos.map(async p => ({ id: p.id, stopId: p.stopId, caption: p.caption, dataUrl: await asDataUrl(p.blob) }))) }
}
export async function parseBackup(raw: string): Promise<{ data: AppData; photos: Photo[] }> {
  const b: unknown = JSON.parse(raw)
  if (!object(b) || b.format !== 'sendai-trip-backup' || b.version !== 1 || !isAppData(b.data) || !Array.isArray(b.photos) || b.photos.length > 1000) throw new Error('不是有效的仙台旅遊備份（版本 1）。原有資料未變更。')
  const ids = new Set(b.data.stops.map(s => s.id))
  const photos: Photo[] = []
  for (const p of b.photos) {
    if (!object(p) || !string(p.id) || !p.id || !string(p.stopId) || !ids.has(String(p.stopId)) || !string(p.caption) || typeof p.dataUrl !== 'string' || p.dataUrl.length > 8 * 1024 * 1024 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(p.dataUrl)) throw new Error('備份照片格式不正確，原有資料未變更。')
    const [header, base64] = p.dataUrl.split(',')
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const mime = header.slice(5, header.indexOf(';'))
    const prefix = (...signature: number[]) => signature.every((b, i) => bytes[i] === b)
    const valid = mime === 'image/png' ? prefix(137,80,78,71,13,10,26,10) : mime === 'image/jpeg' ? prefix(255,216,255) : prefix(82,73,70,70) && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP'
    if (!valid) throw new Error('備份照片格式不正確：圖片內容損壞。')
    const blob = new Blob([bytes], { type: mime })
    if (typeof createImageBitmap === 'function') {
      try { const image = await createImageBitmap(blob); image.close() } catch { throw new Error('備份照片無法解碼，原有資料未變更。') }
    }
    photos.push({ id: String(p.id), stopId: String(p.stopId), caption: String(p.caption), blob })
  }
  if (!unique(photos)) throw new Error('備份照片編號重複')
  return { data: b.data, photos }
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
