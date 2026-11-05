import { describe, expect, it } from 'vitest'
import { calendarDate, coupons, couponState, imageUrl, japanDate, localImagePath, parseCouponCatalog, tax } from './content'
import type { Coupon } from './content'

const coupon: Coupon = {
  id: 'unit-test', shopName: '測試券（不是真實優惠券）', category: 'Bic Camera',
  offerSummary: '僅供自動測試', imagePath: '/coupons/test.jpg', instructions: ['請核對條件'],
  conditions: ['僅供測試'], validFrom: '2026-11-01', validUntil: '2026-11-24',
  sourceNotes: '自動測試資料，不會加入 App', isExample: false,
}
const catalog = () => ({ version: 1, updatedAt: '2026-11-05', categories: ['Bic Camera'], items: [{ ...coupon }] })

describe('指南內容與優惠券日期', () => {
  it('以日本午夜作為到期界線，當日仍可核對使用條件', () => {
    expect(japanDate(new Date('2026-11-24T14:59:59Z'))).toBe('2026-11-24')
    expect(couponState(coupon, new Date('2026-11-24T14:59:59Z')).kind).toBe('dated')
    expect(couponState(coupon, new Date('2026-11-24T15:00:00Z')).kind).toBe('expired')
  })
  it('區分尚未生效、日期不明與不可使用的範例', () => {
    expect(couponState(coupon, new Date('2026-10-30T12:00:00Z')).kind).toBe('upcoming')
    expect(couponState({ ...coupon, validUntil: null }).label).toBe('有效期限待確認')
    expect(couponState({ ...coupon, isExample: true }, new Date('2027-01-01Z')).label).toBe('範例・不可使用')
  })
  it('拒絕不存在的日期與倒置的有效期間', () => {
    for (const date of ['2026-02-29', '2026-11-31', '2026/11/01', '2026-11-01T00:00:00Z']) expect(calendarDate(date)).toBe(false)
    expect(calendarDate('2028-02-29')).toBe(true)
    const invalid = catalog(); invalid.items[0].validFrom = '2026-12-01'
    expect(parseCouponCatalog(invalid)).toBeNull()
  })
  it('圖片只能使用指定的專案內檔案，拒絕外站、路徑跳脫與 SVG', () => {
    for (const path of ['https://example.com/a.jpg', '//example.com/a.jpg', '/coupons/../a.jpg', '/coupons//a.jpg', '/coupons/%2e%2e/a.jpg', '/coupons/a.svg', '/private/a.jpg']) {
      expect(localImagePath(path)).toBe(false)
      expect(() => imageUrl(path)).toThrow()
    }
    expect(localImagePath('/coupons/bic-camera/2026-11.webp')).toBe(true)
    expect(imageUrl('/tax-refund/01-platforms.jpg')).toMatch(/tax-refund\/01-platforms\.jpg$/)
  })
  it('拒絕缺欄位、重複 ID、無效分類與教學資料夾中的券圖', () => {
    expect(parseCouponCatalog(catalog())).not.toBeNull()
    expect(parseCouponCatalog({ ...catalog(), items: [{ id: 'incomplete' }] })).toBeNull()
    expect(parseCouponCatalog({ ...catalog(), items: [coupon, coupon] })).toBeNull()
    expect(parseCouponCatalog({ ...catalog(), categories: ['藥妝'] })).toBeNull()
    expect(parseCouponCatalog({ ...catalog(), items: [{ ...coupon, imagePath: '/tax-refund/wrong.jpg' }] })).toBeNull()
    expect(parseCouponCatalog({ ...catalog(), items: [{ ...coupon, imagePath: 'https://example.com/coupon.jpg' }] })).toBeNull()
  })
  it('正式資料沒有冒充真實優惠券，教學的來源與未確認狀態明確', () => {
    expect(coupons).not.toBeNull()
    expect(coupons!.items.every(c => c.isExample && c.imagePath === null)).toBe(true)
    expect(tax.sections).toHaveLength(4)
    expect(tax.sections.every(s => localImagePath(s.image.path) && s.rawText.length > 0)).toBe(true)
    expect(tax.officialVerifiedAt).toBeNull()
    expect(tax.verificationStatus).toBe('待官方核對')
    expect(tax.sendaiNotice).toContain('都未列仙台')
  })
  it('保留費用的不同計算基礎，未知費率不視為零', () => {
    expect(tax.merchants).toHaveLength(21)
    expect(tax.merchants.find(m => m.name === 'UNIQLO')?.basis).toBe('消費稅額')
    expect(tax.merchants.find(m => m.name === '阿卡將')?.basis).toBe('含稅價')
    expect(tax.merchants.find(m => m.name === '3COINS')?.basis).toBe('固定日圓／每筆')
    expect(tax.merchants.find(m => m.name === 'LUMINE、NEWoMan')?.notes).toContain('不當作 0%')
    expect(tax.merchants.find(m => m.name === 'mont-bell')?.notes).toContain('0.28%～0.32%')
    expect(tax.cashReminder).toContain('原退稅業者指定退稅金額 10%')
  })
})
