import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: '主導覽' }).getByRole('link', { name })
const card = (page: Page, name: string) => page.locator('article.stop-row').filter({ has: page.getByRole('heading', { name, exact: true }) })
async function addStop(page: Page, name: string) {
  await page.getByRole('button', { name: '新增一段旅程' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('景點名稱', { exact: true }).fill(name)
  await dialog.getByLabel('開始時間').fill('10:00')
  await dialog.getByLabel('結束時間').fill('11:00')
  await dialog.getByLabel('簡短介紹').fill('測試個人行程與旅記保存')
  await dialog.getByRole('button', { name: '儲存行程' }).click()
  await expect(card(page, name)).toBeVisible()
}

test('五日行程可切換，地圖使用公共運輸與步行', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('仙台賞楓')
  const counts = [5, 8, 9, 8, 6]
  for (let day = 1; day <= 5; day++) {
    await page.getByRole('button', { name: new RegExp(`DAY ${day} `) }).click()
    await expect(page.locator('article.stop-row')).toHaveCount(counts[day - 1])
  }
  await page.getByRole('button', { name: /DAY 1 / }).click()
  const first = page.locator('article.stop-row').first()
  await expect(first.getByRole('link', { name: /地圖導航/ })).toHaveAttribute('href', /travelmode=transit/)
  await expect(first.getByRole('link', { name: /步行前往/ })).toHaveAttribute('href', /travelmode=walking/)
  await page.getByRole('button', { name: '路線總覽' }).click()
  await expect(page.locator('.route-panel li')).toHaveCount(5)
})

test('行程新增、排序、改日期、勾選、筆記與刪除可保存', async ({ page }) => {
  await page.goto('/')
  const name = '測試・秋日咖啡'
  await addStop(page, name)
  await page.getByRole('button', { name: `上移 ${name}`, exact: true }).click()
  await expect(page.locator('article.stop-row').nth(4).getByRole('heading', { name })).toBeVisible()
  await page.getByRole('button', { name: `編輯 ${name}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: /^日期/ }).selectOption('2')
  await dialog.getByLabel('開始時間').fill('08:00')
  await dialog.getByRole('button', { name: '儲存行程' }).click()
  await page.getByRole('button', { name: `完成 ${name}`, exact: true }).click()
  await card(page, name).getByText('旅記與照片', { exact: true }).click()
  await card(page, name).getByRole('textbox', { name: `${name} 旅行筆記`, exact: true }).fill('想記住這一片紅葉。')
  await page.reload()
  await page.getByRole('button', { name: /DAY 2 / }).click()
  await expect(page.getByRole('button', { name: `完成 ${name}`, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await card(page, name).getByText('旅記與照片', { exact: true }).click()
  await expect(card(page, name).getByRole('textbox', { name: `${name} 旅行筆記`, exact: true })).toHaveValue('想記住這一片紅葉。')
  page.once('dialog', d => d.accept())
  await card(page, name).getByRole('button', { name: '刪除此行程' }).click()
  await expect(card(page, name)).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: /DAY 2 / }).click()
  await expect(card(page, name)).toHaveCount(0)
})

test('購物清單新增、數量、編輯、勾選、刪除及還原', async ({ page }) => {
  await page.goto('/#guide')
  await page.getByRole('button', { name: /^日本服裝購物/ }).click()
  await page.getByRole('button', { name: '新增物品', exact: true }).click()
  await page.getByLabel('物品名稱', { exact: true }).fill('日牌針織外套')
  await page.getByLabel('數量', { exact: true }).fill('2')
  await page.getByRole('button', { name: '儲存物品' }).click()
  await page.getByRole('button', { name: '增加 日牌針織外套 數量' }).click()
  const row = page.locator('.packing-list li').filter({ hasText: '日牌針織外套' })
  await expect(row.locator('.quantity')).toHaveText('3')
  await page.getByLabel('日牌針織外套', { exact: true }).check()
  await page.getByRole('button', { name: '編輯 日牌針織外套' }).click()
  await page.getByLabel('物品名稱', { exact: true }).fill('日牌保暖外套')
  await page.getByRole('button', { name: '儲存物品' }).click()
  await page.reload()
  await page.getByRole('button', { name: /^日本服裝購物/ }).click()
  await expect(page.getByLabel('日牌保暖外套', { exact: true })).toBeChecked()
  await expect(page.locator('.packing-list li').filter({ hasText: '日牌保暖外套' }).locator('.quantity')).toHaveText('3')
  await page.getByRole('button', { name: '刪除 日牌保暖外套' }).click()
  await page.getByRole('button', { name: '確定刪除物品' }).click()
  await expect(page.getByLabel('日牌保暖外套', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^日本購物清單/ }).click()
  await expect(page.locator('.packing-list li')).toHaveCount(6)
  await page.getByRole('button', { name: '還原預設清單', exact: true }).click()
  await page.getByRole('button', { name: '確定還原預設清單' }).click()
  await expect(page.locator('.packing-list li')).toHaveCount(6)
  await expect(page.locator('.packing-list li').filter({ hasText: 'EVE' }).locator('.quantity')).toHaveText('4')
})

test('航班與飯店編輯可保存，訂單安全驗證與緊急撥號', async ({ page }) => {
  await page.goto('/#guide')
  await page.getByLabel('住宿名稱').fill('我的仙台飯店')
  await page.getByRole('textbox', { name: '旅行備註', exact: true }).fill('入住前先寄放行李')
  await page.getByLabel('訂單連結（選填）').fill('javascript:alert(1)')
  await expect(page.getByText('請填寫有效的 http 或 https 網址。')).toBeVisible()
  await expect(page.getByRole('link', { name: '開啟我的訂單' })).toHaveCount(0)
  await page.getByLabel('訂單連結（選填）').fill('https://example.com/order')
  await expect(page.getByRole('link', { name: '開啟我的訂單' })).toHaveAttribute('href', 'https://example.com/order')
  await page.reload()
  await expect(page.getByLabel('住宿名稱')).toHaveValue('我的仙台飯店')
  await expect(page.getByRole('textbox', { name: '旅行備註', exact: true })).toHaveValue('入住前先寄放行李')
  await expect(page.locator('a[href="tel:110"]')).toBeVisible()
  await expect(page.locator('a[href="tel:119"]')).toBeVisible()
})

test('照片使用 IndexedDB 保存，完整備份能還原照片與旅記', async ({ page }) => {
  await page.goto('/')
  const name = '備份測試・楓葉'
  await addStop(page, name)
  await card(page, name).getByText('旅記與照片', { exact: true }).click()
  await card(page, name).getByRole('textbox', { name: `${name} 旅行筆記`, exact: true }).fill('紅葉紀念日')
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20
    canvas.getContext('2d')!.fillRect(0, 0, 20, 20)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await card(page, name).locator('input[type=file]').setInputFiles({ name: 'maple.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(card(page, name).getByRole('img', { name: 'maple.png' })).toBeVisible()
  await expect(card(page, name).getByRole('img', { name: `${name} 的旅途照片`, exact: true })).toBeVisible()
  await page.reload()
  await card(page, name).getByText('旅記與照片', { exact: true }).click()
  await expect(card(page, name).getByRole('img', { name: 'maple.png' })).toBeVisible()
  const saved = await page.evaluate(() => localStorage.getItem('sendai-journal-v1'))
  expect(saved).not.toContain('data:image')
  await page.getByRole('button', { name: '資料備份' }).click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '匯出完整 JSON 備份' }).click()
  const download = await downloaded
  const backup = await readFile((await download.path())!, 'utf8')
  const parsed = JSON.parse(backup)
  expect(parsed.photos).toHaveLength(1)
  expect(parsed.photos[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/)
  await page.getByRole('dialog').getByRole('button', { name: '關閉', exact: true }).click()
  page.once('dialog', d => d.accept())
  await card(page, name).getByRole('button', { name: '刪除此行程' }).click()
  await expect(card(page, name)).toHaveCount(0)
  await page.getByRole('button', { name: '資料備份' }).click()
  page.once('dialog', d => d.accept())
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await card(page, name).getByText('旅記與照片', { exact: true }).click()
  await expect(card(page, name).getByRole('img', { name: 'maple.png' })).toBeVisible()
  await expect(card(page, name).getByRole('textbox', { name: `${name} 旅行筆記`, exact: true })).toHaveValue('紅葉紀念日')
  await page.getByRole('button', { name: '資料備份' }).click()
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":100}') })
  await expect(page.getByRole('status')).toContainText('匯入失敗')
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('天氣成功、網路錯誤、預報範圍外與無資料狀態', async ({ page }) => {
  let mode = 'success'
  const requests: string[] = []
  await page.route('https://api.open-meteo.com/**', async route => {
    requests.push(route.request().url())
    if (mode === 'error') { await route.fulfill({ status: 503, body: 'unavailable' }); return }
    const dates = mode === 'empty' ? [] : mode === 'outside' ? ['2026-11-05'] : ['2026-11-20','2026-11-21','2026-11-22','2026-11-23','2026-11-24']
    const daily = { time: dates, weather_code: dates.map(() => 0), temperature_2m_max: dates.map(() => 14), temperature_2m_min: dates.map(() => 7), apparent_temperature_max: dates.map(() => 12), apparent_temperature_min: dates.map(() => 5), precipitation_probability_max: dates.map(() => 20), sunrise: dates.map(d => `${d}T06:20`), sunset: dates.map(d => `${d}T16:30`) }
    await route.fulfill({ json: { daily } })
  })
  await page.goto('/#weather')
  await expect(page.getByText('晴朗', { exact: true })).toHaveCount(5)
  await expect(page.getByText(/資料取得時間：/)).toBeVisible()
  await expect(page.getByText('降雨機率 20%', { exact: false })).toHaveCount(5)
  mode = 'error'
  await page.getByRole('button', { name: '松島', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('HTTP 503')
  expect(requests.at(-1)).toContain('latitude=38.3734')
  mode = 'outside'
  await page.getByRole('button', { name: '岩沼', exact: true }).click()
  await expect(page.getByText('尚無此日預報', { exact: true })).toHaveCount(5)
  await expect(page.getByText('SEASONAL REFERENCE · 非即時預報')).toBeVisible()
  expect(requests.at(-1)).toContain('latitude=38.1042')
  mode = 'empty'
  await page.getByRole('button', { name: '重新取得天氣' }).click()
  await expect(page.getByText('天氣來源目前沒有每日資料，請稍後重新取得。')).toBeVisible()
})

test('三頁響應式不產生水平溢出，主導覽正常', async ({ page }, testInfo) => {
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { daily: { time: [] } } }))
  await page.goto('/')
  // Let the intentional page entrance finish before collecting the design review image.
  await page.waitForTimeout(500)
  await page.screenshot({ path: `/tmp/sendai-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' })
  for (const name of ['行程 Itinerary', '指南 Guide', '天氣 Weather', '分帳 Expenses']) {
    await nav(page, name).click()
    await expect(nav(page, name)).toHaveAttribute('aria-current', 'page')
    const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport)
  }
  if (testInfo.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 740 })
    for (const name of ['行程 Itinerary', '指南 Guide', '天氣 Weather', '分帳 Expenses']) {
      await nav(page, name).click()
      await expect(nav(page, name)).toHaveAttribute('aria-current', 'page')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    }
  }
})

test('未設定雲端分帳時清楚顯示未啟用，既有本機行程資料保持不變', async ({ page }) => {
  await page.goto('/')
  const done=page.locator('article.stop-row').first().getByRole('button',{name:/^完成 /})
  await done.click()
  const saved=await page.evaluate(()=>localStorage.getItem('sendai-journal-v1'))
  await nav(page,'分帳 Expenses').click()
  await expect(page.getByRole('heading',{name:'雲端分帳尚未啟用',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'新增消費',exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'寄送登入連結',exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>localStorage.getItem('sendai-journal-v1'))).toBe(saved)
  await nav(page,'行程 Itinerary').click()
  await expect(page.locator('article.stop-row')).toHaveCount(5)
  await expect(done).toHaveAttribute('aria-pressed','true')
})
