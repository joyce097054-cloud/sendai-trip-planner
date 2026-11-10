import couponJson from '../../data/coupons.json'
import taxJson from '../../data/tax-refund.json'

export interface Coupon {
  id: string; shopName: string; category: string; offerSummary: string; imagePath: string | null;
  instructions: string[]; conditions: string[]; validFrom: string | null; validUntil: string | null;
  sourceNotes: string; isExample: boolean;
  kind?: 'static' | 'external'; images?: string[]; externalUrl?: string;
}
export interface CouponCatalog { version: 1; updatedAt: string; categories: string[]; items: Coupon[] }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 10000
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 100 && v.every(text)
export function calendarDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
}
export function localImagePath(value: unknown): value is string {
  return typeof value === 'string' && /^\/(coupons|tax-refund)\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(png|jpe?g|webp)$/i.test(value) && value.slice(1).split('/').every(s => s !== '.' && s !== '..' && s !== '')
}
export function imageUrl(path: string) {
  if (!localImagePath(path)) throw new Error('圖片必須使用專案內的 coupons 或 tax-refund 檔案。')
  const embedded = (globalThis as typeof globalThis & { __SENDAI_GUIDE_IMAGES__?: Record<string, string> }).__SENDAI_GUIDE_IMAGES__
  if (embedded?.[path]) return embedded[path]
  return `${import.meta.env.BASE_URL}${path.slice(1)}`
}
export function parseCouponCatalog(value: unknown): CouponCatalog | null {
  if (!record(value) || value.version !== 1 || !calendarDate(value.updatedAt) || !strings(value.categories) || !Array.isArray(value.items) || value.items.length > 500 || new Set(value.categories).size !== value.categories.length) return null
  const ids = new Set<string>()
  for (const c of value.items) {
    if (!record(c) || !['id','shopName','category','offerSummary','sourceNotes'].every(k => text(c[k])) || !strings(c.instructions) || !strings(c.conditions) || typeof c.isExample !== 'boolean') return null
    if (ids.has(String(c.id)) || !value.categories.includes(String(c.category))) return null
    ids.add(String(c.id))
    if (c.imagePath !== null && (!localImagePath(c.imagePath) || !c.imagePath.startsWith('/coupons/'))) return null
    if (c.images !== undefined && (!Array.isArray(c.images) || c.images.length > 30 || !c.images.every(p=>localImagePath(p)&&p.startsWith('/coupons/')))) return null
    if (c.kind !== undefined && !['static','external'].includes(String(c.kind))) return null
    if (c.kind === 'external') { try { const u=new URL(String(c.externalUrl)); if(u.protocol!=='https:'||u.username||u.password) return null } catch { return null } }
    if ((c.validFrom !== null && !calendarDate(c.validFrom)) || (c.validUntil !== null && !calendarDate(c.validUntil))) return null
    if (typeof c.validFrom === 'string' && typeof c.validUntil === 'string' && c.validFrom > c.validUntil) return null
  }
  return value as unknown as CouponCatalog
}
export function japanDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now) }
export function couponState(coupon: Coupon, now = new Date()) {
  if (coupon.kind === 'external') return { kind:'dynamic', label:'官方動態券 · 需連線' }
  if (coupon.isExample) return { kind:'example', label:'範例・不可使用' }
  const day = japanDate(now)
  if (coupon.validUntil && day > coupon.validUntil) return { kind:'expired', label:'已過期' }
  if (coupon.validFrom && day < coupon.validFrom) return { kind:'upcoming', label:'尚未生效' }
  if (!coupon.validUntil) return { kind:'unknown', label:'有效期限待確認' }
  return { kind:'dated', label:'請核對使用條件' }
}
export const coupons = parseCouponCatalog(couponJson)
export const tax = taxJson
