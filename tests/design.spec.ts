import { test, expect } from '@playwright/test'

test('四頁導覽固定貼齊底部，手機操作區與內容寬度正常', async ({ page }, testInfo) => {
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { daily: { time: [] } } }))
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: '主導覽' })
  const widths = testInfo.project.name === 'mobile' ? [320, 390, 430] : [1440]
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['行程 Itinerary', '指南 Guide', '天氣 Weather', '分帳 Expenses']) {
      await nav.getByRole('link', { name, exact: true }).click()
      await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const box = (await nav.boundingBox())!
      expect(box.x).toBe(0); expect(box.width).toBe(width)
      expect(Math.round(box.y + box.height)).toBe(844)
      if (name === '行程 Itinerary') {
        for (const button of await page.locator('.day-tabs button, .stop-actions .icon-button, .complete-button').all()) {
          const target = (await button.boundingBox())!
          expect(target.width).toBeGreaterThanOrEqual(44)
          expect(target.height).toBeGreaterThanOrEqual(44)
        }
      } else await expect(page.locator('.hero-art')).toHaveCount(0)
    }
  }
  await expect(nav.locator('small')).toHaveCount(0)
})

test('分頁保留各自捲動位置，鍵盤可跳至主要內容', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { daily: { time: [] } } }))
  await page.goto('/#guide')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '跳至主要內容' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  await expect(page).toHaveURL(/#guide$/)
  await page.getByRole('button', { name: /^日本購物清單/ }).click()
  await page.getByRole('heading', { name: '需要幫忙時', exact: true }).scrollIntoViewIfNeeded()
  const previous = await page.evaluate(() => window.scrollY)
  expect(previous).toBeGreaterThan(500)
  const nav = page.getByRole('navigation', { name: '主導覽' })
  await nav.getByRole('link', { name: '天氣 Weather', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.getByRole('button', { name: '松島', exact: true }).click()
  await nav.getByRole('link', { name: '指南 Guide', exact: true }).click()
  await expect.poll(() => page.evaluate(saved => Math.abs(window.scrollY - saved), previous)).toBeLessThanOrEqual(5)
  await expect(page.getByRole('button', { name: /^日本購物清單/ })).toHaveAttribute('aria-pressed', 'true')
  await nav.getByRole('link', { name: '天氣 Weather', exact: true }).click()
  await expect(page.getByRole('button', { name: '松島', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('目前天氣、過期模式資料與每日預報明確分開', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-06T08:30:00Z'))
  let mode = 'current'
  await page.route('https://api.open-meteo.com/**', route => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('current')).toContain('temperature_2m')
    expect(url.searchParams.get('temperature_unit')).toBe('celsius')
    return route.fulfill({ json: {
      current: mode === 'missing' ? undefined : { time: mode === 'current' ? '2026-11-06T17:30' : '2026-11-06T08:00', temperature_2m: 12.4, apparent_temperature: 9.2, weather_code: 2, is_day: 0 },
      daily: { time: ['2026-11-20'], temperature_2m_max: [18], temperature_2m_min: [8], weather_code: [0], precipitation_probability_max: [20] },
    } })
  })
  await page.goto('/#weather')
  const current = page.getByRole('region', { name: '仙台現在' })
  await expect(current.getByText('即時・模式估計', { exact: true })).toBeVisible()
  await expect(current.locator('.current-reading > strong')).toContainText('12°')
  await expect(current).toContainText('非測站實測')
  await expect(page.locator('.weather-card').first()).toContainText('18°')
  mode = 'stale'
  await page.getByRole('button', { name: '重新取得天氣', exact: true }).click()
  await expect(current.getByText('最近資料・非即時', { exact: true })).toBeVisible()
  mode = 'missing'
  await page.getByRole('button', { name: '重新取得天氣', exact: true }).click()
  await expect(current.getByText('尚未取得', { exact: true })).toBeVisible()
  await expect(current.locator('.current-unavailable > strong')).toHaveText('—')
  await expect(page.locator('.weather-card').first()).toContainText('18°')
})
