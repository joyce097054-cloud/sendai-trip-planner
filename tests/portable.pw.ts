import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'

test('單檔 HTML 無外部資源，行程、照片與完整備份可保存還原', async ({ page }) => {
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()) })
  // Managed Chromium blocks file:// URLs by administrator policy. Validate the
  // exact standalone artifact through an intercepted local HTTP document instead;
  // direct file opening on Windows remains a manual check, not a passing claim.
  const url = 'http://127.0.0.1:4179/sendai-travel-journal.html'
  const html = await readFile(resolve('portable/sendai-travel-journal.html'), 'utf8')
  await page.route('**/*', route => route.request().url() === url ? route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }) : route.abort())
  await page.goto(url)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('仙台賞楓')
  await expect(page.locator('.stop-row')).toHaveCount(9)
  await expect(page.locator('.hero-art')).toBeVisible()
  expect(await page.locator('.hero-art').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await page.getByRole('button', { name: '新增一段旅程' }).click()
  await page.getByRole('dialog').getByLabel('景點名稱', { exact: true }).fill('免安裝版咖啡')
  await page.getByRole('button', { name: '儲存行程' }).click()
  const card = page.locator('.stop-row').filter({ hasText: '免安裝版咖啡' })
  await card.getByRole('button', { name: '完成 免安裝版咖啡', exact: true }).click()
  await card.getByText('旅記與照片', { exact: true }).click()
  await card.getByRole('textbox', { name: '免安裝版咖啡 旅行筆記', exact: true }).fill('在 Windows 也能直接使用。')
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; c.getContext('2d')!.fillRect(0,0,20,20); return c.toDataURL().split(',')[1] })
  await card.locator('input[type=file]').setInputFiles({ name: 'autumn.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(card.getByRole('img', { name: 'autumn.png' })).toBeVisible()
  await page.reload()
  await card.getByText('旅記與照片', { exact: true }).click()
  await expect(card.getByRole('img', { name: 'autumn.png' })).toBeVisible()
  await expect(card.getByRole('textbox', { name: '免安裝版咖啡 旅行筆記', exact: true })).toHaveValue('在 Windows 也能直接使用。')
  await expect(card.getByRole('button', { name: '完成 免安裝版咖啡', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '資料備份' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '匯出完整 JSON 備份' }).click()
  const backup = await readFile((await (await download).path())!, 'utf8')
  expect(JSON.parse(backup).photos).toHaveLength(1)
  await page.getByRole('dialog').getByRole('button', { name: '關閉', exact: true }).click()
  page.once('dialog', d => d.accept())
  await card.getByRole('button', { name: '刪除此行程' }).click()
  await expect(card).toHaveCount(0)
  await page.getByRole('button', { name: '資料備份' }).click()
  page.once('dialog', d => d.accept())
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await card.getByText('旅記與照片', { exact: true }).click()
  await expect(card.getByRole('img', { name: 'autumn.png' })).toBeVisible()
  await page.getByRole('navigation', { name: '主導覽' }).getByRole('link', { name: '指南 Guide' }).click()
  await expect(page.getByRole('heading', { name: '日本優惠券', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '日本免稅與新退稅手冊', exact: true })).toBeVisible()
  await expect(page.locator('.merchant-row')).toHaveCount(21)
  // Exercise actual user originals, embedded by the portable builder. No image
  // requests may be made to a server, and no fixture replaces these four files.
  for (const id of ['platforms', 'prepare', 'airport', 'cash']) {
    const chapter = page.locator(`#tax-${id}`)
    await chapter.evaluate((el: HTMLDetailsElement) => { el.open = true })
    await chapter.locator('.tax-image-button').click()
    const dialog = page.getByRole('dialog')
    const img = dialog.locator('.media-scroll img')
    await expect(img).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => ({ width: el.naturalWidth, height: el.naturalHeight }))).toEqual({ width: 1080, height: 1350 })
    await dialog.getByRole('button', { name: '放大圖片', exact: true }).click()
    await expect(dialog.locator('output')).toHaveText('150%')
    await dialog.getByRole('button', { name: '關閉', exact: true }).click()
  }
  expect(requests.every(request => request === url)).toBe(true)
  expect(errors).toEqual([])
})
