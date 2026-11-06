import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const couponSection = (page: Page) => page.getByRole('region', { name: '隨手帶著的優惠券' })
const taxSection = (page: Page) => page.getByRole('region', { name: '日本免稅與新退稅手冊' })

// These fixtures exist only in intercepted browser requests. They are never written to public/ or production JSON.
async function imageFixture(page: Page, broken = false) {
  const fixtureCoupon = {
    version: 1, updatedAt: '2026-11-05', categories: ['Bic Camera', '藥妝'], items: [{
      id: 'browser-test-only', shopName: '測試券（非真券）', category: 'Bic Camera',
      offerSummary: '只用於驗證圖片放大', imagePath: '/coupons/ui-test.png',
      instructions: ['測試使用說明'], conditions: ['不能出示使用'], validFrom: '2020-01-01', validUntil: '2020-01-02',
      sourceNotes: '自動測試攔截資料', isExample: false,
    }],
  }
  const teaching = JSON.parse(await readFile(new URL('../src/data/tax-refund.json', import.meta.url), 'utf8'))
  teaching.sections[0].image.available = true
  await page.route('**/src/data/coupons.json*', route => route.fulfill({ contentType: 'text/javascript', body: `export default ${JSON.stringify(fixtureCoupon)}` }))
  await page.route('**/src/data/tax-refund.json*', route => route.fulfill({ contentType: 'text/javascript', body: `export default ${JSON.stringify(teaching)}` }))
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=', 'base64')
  for (const path of ['**/coupons/ui-test.png', '**/tax-refund/01-platforms.jpg']) {
    await page.route(path, route => broken ? route.fulfill({ status: 404, body: 'test missing asset' }) : route.fulfill({ contentType: 'image/png', body: png }))
  }
}

test('指南優惠券範例與空分類清楚，詳細內容留在 App 內', async ({ page }) => {
  await page.goto('/#guide')
  const coupons = couponSection(page)
  await expect(coupons.getByText('0 張真實券資料')).toBeVisible()
  await expect(coupons.getByText('範例・不可使用', { exact: true })).toBeVisible()
  await coupons.getByRole('button', { name: '藥妝', exact: true }).click()
  await expect(coupons.getByText('這個分類還沒有優惠券。')).toBeVisible()
  await coupons.getByRole('button', { name: '全部', exact: true }).click()
  const entry = coupons.getByRole('button', { name: '查看 Bic Camera 優惠券（範例）', exact: true })
  await entry.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('這是範例資料，不是真實優惠券。')).toBeVisible()
  await expect(dialog.getByText('目前沒有優惠券圖片；這筆資料不可當作真實優惠券使用。')).toBeVisible()
  await expect(dialog.locator('a, iframe')).toHaveCount(0)
  expect(page.context().pages()).toHaveLength(1)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(entry).toBeFocused()
  await expect(page).toHaveURL(/#guide$/)
})

test('退稅章節導航、機場比較與商家搜尋保留未確認資訊', async ({ page }) => {
  await page.goto('/#guide')
  const tax = taxSection(page)
  await expect(tax.getByText(/資料整理日期：2026\/11\/06/)).toBeVisible()
  await expect(tax.getByText(/提供的 VJW 七機場清單.*都未列仙台/)).toBeVisible()
  await expect(tax.locator('.platform-list article')).toHaveCount(4)
  const original = tax.locator('#tax-platforms .tax-image-button img')
  await original.scrollIntoViewIfNeeded()
  await expect.poll(() => original.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1080)
  await tax.getByRole('navigation', { name: '免稅教學章節' }).getByRole('button', { name: /機場確認/ }).click()
  await expect(tax.locator('#tax-airport')).toHaveAttribute('open', '')
  await expect(tax.getByRole('table').getByRole('row')).toHaveCount(6)
  await expect(tax.getByText('Customs_WiFi_For_TaxRefund', { exact: true })).toBeVisible()
  await expect(tax.getByText('jcustoms', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/#guide$/)
  await tax.getByRole('navigation', { name: '免稅教學章節' }).getByRole('button', { name: /現金退稅/ }).click()
  await expect(tax.locator('.cash-list article')).toHaveCount(2)
  await expect(tax.locator('.merchant-row')).toHaveCount(21)
  await tax.getByRole('searchbox').fill('UNIQLO')
  await tax.locator('.merchant-row summary').click()
  await expect(tax.locator('.merchant-row')).toHaveCount(1)
  await expect(tax.locator('.merchant-row')).toContainText('消費稅額約 10%')
  await expect(tax.locator('.merchant-row')).toContainText('使用者提供，待官方核對')
  await tax.getByRole('searchbox').fill('LUMINE')
  await tax.locator('.merchant-row summary').click()
  await expect(tax.locator('.merchant-row')).toContainText('未填費率，不當作 0%。')
  await tax.getByRole('searchbox').fill('mont-bell')
  await tax.locator('.merchant-row summary').click()
  await expect(tax.locator('.merchant-row')).toContainText('提領費另按未稅價收 0.28%～0.32%。')
  await tax.getByRole('searchbox').fill('沒有這間商店')
  await expect(tax.getByText('沒有符合的商家或平台。')).toBeVisible()
  await page.getByRole('navigation', { name: '旅行指南章節' }).getByRole('button', { name: '行李與購物', exact: true }).click()
  await expect(page.getByRole('heading', { name: '行李與購物清單' })).toBeInViewport()
  await expect(page).toHaveURL(/#guide$/)
})

test('券圖與教學圖可在 App 內放大、還原及關閉，已過期券有提示', async ({ page }) => {
  await imageFixture(page)
  await page.goto('/#guide')
  const coupons = couponSection(page)
  await expect(coupons.getByText('已過期', { exact: true })).toBeVisible()
  await coupons.getByRole('button', { name: /查看 測試券/ }).click()
  const dialog = page.getByRole('dialog')
  const img = dialog.getByRole('img', { name: '測試券（非真券） 優惠券完整圖片', exact: true })
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  await expect(dialog.getByText('這張優惠券已過期，僅供查看。')).toBeVisible()
  await expect(dialog.getByText('測試使用說明', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '放大圖片', exact: true }).click()
  await expect(dialog.locator('output')).toHaveText('150%')
  await dialog.getByRole('button', { name: '原尺寸', exact: true }).click()
  await expect(dialog.locator('output')).toHaveText('100%')
  await dialog.getByRole('button', { name: '關閉', exact: true }).click()
  const tax = taxSection(page)
  await tax.getByRole('button', { name: /點擊放大原圖/ }).click()
  await expect(dialog.getByRole('img', { name: /使用者提供的日本退稅平台 APP/ })).toBeVisible()
  await dialog.getByRole('button', { name: '放大圖片', exact: true }).click()
  await expect(dialog.locator('output')).toHaveText('150%')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/#guide$/)
  expect(page.context().pages()).toHaveLength(1)
})

test('四張使用者教學原圖依章節顯示並可放大關閉', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#guide')
  const chapters = [
    { id: 'platforms', label: '平台整理', file: '01-platforms.jpg' },
    { id: 'prepare', label: '出發準備', file: '02-prepare-home-screen.jpg' },
    { id: 'airport', label: '機場確認', file: '03-vjw-kiosk.jpg' },
    { id: 'cash', label: '現金退稅', file: '04-cash-refund.jpg' },
  ]
  for (const chapter of chapters) {
    await taxSection(page).getByRole('navigation', { name: '免稅教學章節' }).getByRole('button', { name: new RegExp(chapter.label) }).click()
    const entry = page.locator(`#tax-${chapter.id} .tax-image-button`)
    await entry.click()
    const dialog = page.getByRole('dialog')
    const img = dialog.locator('.media-scroll img')
    await expect(img).toHaveAttribute('src', new RegExp(`/tax-refund/${chapter.file}$`))
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => ({ width: el.naturalWidth, height: el.naturalHeight }))).toEqual({ width: 1080, height: 1350 })
    await dialog.getByRole('button', { name: '放大圖片', exact: true }).click()
    await expect(dialog.locator('output')).toHaveText('150%')
    await dialog.getByRole('button', { name: '關閉', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(entry).toBeFocused()
  }
  await expect(page.locator('.tax-image-pending')).toHaveCount(0)
  expect(page.context().pages()).toHaveLength(1)
  await expect(page).toHaveURL(/#guide$/)
})

test('圖片載入失敗時仍可閱讀條件與文字教學', async ({ page }) => {
  await imageFixture(page, true)
  await page.goto('/#guide')
  const coupons = couponSection(page)
  await coupons.getByRole('button', { name: /查看 測試券/ }).scrollIntoViewIfNeeded()
  await expect(coupons.getByText('圖片暫缺', { exact: true })).toBeVisible()
  await coupons.getByRole('button', { name: /查看 測試券/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('圖片無法載入，請確認檔案已加入專案。')).toBeVisible()
  await expect(dialog.getByText('不能出示使用', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  const tax = taxSection(page)
  await tax.locator('#tax-platforms > summary').scrollIntoViewIfNeeded()
  await expect(tax.getByText('教學圖片暫時無法載入')).toBeVisible()
  await expect(tax.locator('.platform-list article')).toHaveCount(4)
})

test('指南所有章節與縮放對話框在窄手機不溢出，底部導覽不遮內容', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile') test.skip()
  await imageFixture(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/#guide')
  await page.locator('.tax-chapter').evaluateAll(elements => elements.forEach(e => (e as HTMLDetailsElement).open = true))
  await expect(taxSection(page).getByRole('table')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await couponSection(page).getByRole('button', { name: /查看 測試券/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '放大圖片', exact: true }).click()
  await dialog.getByRole('button', { name: '放大圖片', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  const scroll = dialog.getByRole('region', { name: '可捲動圖片' })
  expect(await scroll.evaluate(el => el.scrollWidth)).toBeGreaterThan(await scroll.evaluate(el => el.clientWidth))
  await page.keyboard.press('Escape')
  const notes = page.getByRole('textbox', { name: '我的實用資訊補充（可編輯）' })
  await notes.scrollIntoViewIfNeeded()
  await expect(notes).toBeInViewport()
  await notes.fill('階段 2 後的個人筆記仍會保存')
  await page.reload()
  await expect(notes).toHaveValue('階段 2 後的個人筆記仍會保存')
  await page.screenshot({ path: '/tmp/sendai-phase2-guide-mobile.png', fullPage: true, animations: 'disabled' })
})
