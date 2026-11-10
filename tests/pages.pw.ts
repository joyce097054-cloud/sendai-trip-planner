import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

function observeProduction(page: Page) {
  const errors: string[] = [], failedResources: string[] = [], rootResources: string[] = []
  const resources = ['document', 'script', 'stylesheet', 'image', 'font', 'fetch', 'xhr']
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:4180' && resources.includes(request.resourceType()) && !url.pathname.startsWith('/sendai-trip-planner/')) rootResources.push(url.pathname)
  })
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:4180/') && response.status() >= 400 && resources.includes(response.request().resourceType())) failedResources.push(`${response.status()} ${response.url()}`)
  })
  return () => {
    expect(errors, 'production page errors').toEqual([])
    expect(rootResources, 'assets must stay under the repository subpath').toEqual([])
    expect(failedResources, 'production document and assets must not return errors').toEqual([])
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { daily: { time: [] } } }))
})

test('正式子路徑載入全部資源，指南深連結與重新整理可使用', async ({ page, request }) => {
  // The fixture must not accidentally serve dist at the host root or provide a
  // dev-server fallback that lets broken root-relative URLs appear to work.
  expect((await request.get('/')).status()).toBe(404)
  expect((await request.get('/sendai-autumn.svg')).status()).toBe(404)
  const assertHealthy = observeProduction(page)
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('仙台賞楓')
  await expect(page.locator('.stop-row')).toHaveCount(9)
  await expect.poll(() => page.locator('.hero-art').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.goto('./#guide')
  await expect(page.getByRole('heading', { name: '旅行手冊', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '日本優惠券', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '日本免稅與新退稅手冊', exact: true })).toBeVisible()
  await expect(page.locator('.merchant-row')).toHaveCount(21)
  await page.getByLabel('住宿名稱').fill('正式網站測試飯店')
  await page.reload()
  await expect(page.getByLabel('住宿名稱')).toHaveValue('正式網站測試飯店')
  await page.getByRole('navigation', { name: '主導覽' }).getByRole('link', { name: '天氣 Weather' }).click()
  await expect(page.getByText('天氣來源目前沒有每日資料，請稍後重新取得。')).toBeVisible()
  const widths = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
  assertHealthy()
})

test('正式子路徑四張教學原圖完整載入並可在 App 內放大', async ({ page }) => {
  const assertHealthy = observeProduction(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./#guide')
  const chapters = ['platforms', 'prepare', 'airport', 'cash']
  for (const id of chapters) {
    const chapter = page.locator(`#tax-${id}`)
    await chapter.evaluate((el: HTMLDetailsElement) => { el.open = true })
    const entry = chapter.locator('.tax-image-button')
    await entry.click()
    const dialog = page.getByRole('dialog')
    const img = dialog.locator('.media-scroll img')
    expect(await img.evaluate((el: HTMLImageElement) => new URL(el.src).pathname)).toMatch(/^\/sendai-trip-planner\/tax-refund\//)
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => ({ width: el.naturalWidth, height: el.naturalHeight }))).toEqual({ width: 1080, height: 1350 })
    await dialog.getByRole('button', { name: '放大圖片', exact: true }).click()
    await expect(dialog.locator('output')).toHaveText('150%')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  }
  assertHealthy()
})

test('正式子路徑可新增編輯行程、完成勾選並於重新整理後保存', async ({ page }) => {
  const assertHealthy = observeProduction(page)
  await page.goto('./')
  await page.getByRole('button', { name: '新增一段旅程' }).click()
  await page.getByRole('dialog').getByLabel('景點名稱', { exact: true }).fill('手機秋日散步')
  await page.getByRole('dialog').getByLabel('開始時間').fill('08:30')
  await page.getByRole('button', { name: '儲存行程' }).click()
  await page.getByRole('button', { name: '編輯 手機秋日散步', exact: true }).click()
  await page.getByRole('dialog').getByLabel('景點名稱', { exact: true }).fill('手機秋日咖啡')
  await page.getByRole('dialog').getByLabel('結束時間').fill('09:30')
  await page.getByRole('button', { name: '儲存行程' }).click()
  await page.getByRole('button', { name: '完成 手機秋日咖啡', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: '手機秋日咖啡', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成 手機秋日咖啡', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.stop-row').filter({ hasText: '手機秋日咖啡' }).locator('.time-rail')).toContainText('08:30')
  assertHealthy()
})

test('正式子路徑照片可保存並以完整 JSON 備份還原', async ({ page }) => {
  const assertHealthy = observeProduction(page)
  await page.goto('./')
  const first = page.locator('.stop-row').first()
  await first.getByText('旅記與照片', { exact: true }).click()
  await first.getByRole('textbox').fill('手機正式網站的楓葉紀念。')
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20
    canvas.getContext('2d')!.fillRect(0, 0, 20, 20)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await first.locator('input[type=file]').setInputFiles({ name: 'pages-maple.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(first.getByRole('img', { name: 'pages-maple.png' })).toBeVisible()
  await page.reload()
  await first.getByText('旅記與照片', { exact: true }).click()
  await expect(first.getByRole('img', { name: 'pages-maple.png' })).toBeVisible()
  await expect(first.getByRole('textbox')).toHaveValue('手機正式網站的楓葉紀念。')
  expect(await page.evaluate(() => localStorage.getItem('sendai-journal-v1'))).not.toContain('data:image')
  await page.getByRole('button', { name: '資料備份' }).click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '匯出完整 JSON 備份' }).click()
  const file = await downloaded
  const backup = await readFile((await file.path())!, 'utf8')
  expect(JSON.parse(backup).photos).toHaveLength(1)
  await page.getByRole('dialog').getByRole('button', { name: '關閉', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await first.getByRole('button', { name: '刪除照片', exact: true }).click()
  await expect(page.getByRole('img', { name: 'pages-maple.png' })).toHaveCount(0)
  await page.getByRole('button', { name: '資料備份' }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'pages-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(first.getByRole('img', { name: 'pages-maple.png' })).toBeVisible()
  await expect(first.getByRole('textbox')).toHaveValue('手機正式網站的楓葉紀念。')
  assertHealthy()
})
