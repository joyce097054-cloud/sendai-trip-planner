import { test, expect, type Page } from '@playwright/test'

async function openHelp(page: Page, state = 'ready') {
  await page.getByRole('button', { name: '加入主畫面與離線使用', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '加入主畫面與離線使用' })
  await expect(dialog.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', state)
  return dialog
}
async function ready(page: Page) {
  await page.goto('./#itinerary')
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  const dialog = await openHelp(page)
  await dialog.getByRole('button', { name: '關閉', exact: true }).click()
}
async function cacheEntries(page: Page) {
  return page.evaluate(async () => {
    const result: string[] = []
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) result.push(request.url)
    return result
  })
}
test.beforeEach(async ({ context, request }) => {
  await request.post('/__pwa-test__/control')
  // No hosted account or weather side effects in these offline-shell tests.
  await context.route('https://*.supabase.co/**', route => route.request().url().startsWith('https://pwa-test.supabase.co/')
    ? route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { testOnly: 'cloud-response-never-cache' } })
    : route.fulfill({ status: 503, json: { message: 'PWA test does not access hosted accounts' } }))
  await context.route('https://api.open-meteo.com/**', route => route.abort())
})

test('安裝資訊、圖示與 worker 範圍正確，初次下載不要求更新', async ({ page, request }) => {
  await ready(page)
  await expect(page.getByRole('button', { name: '更新並重新載入', exact: true })).toHaveCount(0)
  const response = await request.get('./manifest.webmanifest')
  expect(response.headers()['content-type']).toContain('application/manifest+json')
  const manifest = await response.json()
  expect(manifest.name).toBe('仙台賞楓五日自由行')
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toBe('#FFFCF6')
  expect((await cacheEntries(page)).some(url => url.endsWith('/fonts/Huninn-Regular.ttf'))).toBe(true)
  expect(new URL(manifest.start_url, response.url()).href).toBe('http://127.0.0.1:4181/sendai-trip-planner/#itinerary')
  expect(new URL(manifest.scope, response.url()).pathname).toBe('/sendai-trip-planner/')
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(true)
  for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]] as const) {
    expect(await page.evaluate(async file => { const image = new Image(); image.src = new URL(`icons/${file}`, location.href).href; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight } }, file)).toEqual({ width: size, height: size })
  }
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)).toBe('http://127.0.0.1:4181/sendai-trip-planner/')
  const dialog = await openHelp(page)
  await expect(dialog).toContainText('Safari 與主畫面版本的儲存空間可能不同')
  await expect(dialog).toContainText('目前以瀏覽器模式開啟')
})

test('離線重新開啟保留行程、照片與筆記，四張教學圖可放大', async ({ page, context }) => {
  await ready(page)
  await page.getByRole('button', { name: '新增一段旅程', exact: true }).click()
  await page.getByRole('dialog').getByLabel('景點名稱', { exact: true }).fill('離線測試散步')
  await page.getByRole('button', { name: '儲存行程', exact: true }).click()
  const stop = page.locator('.stop-row').filter({ has: page.getByRole('heading', { name: '離線測試散步', exact: true }) })
  await stop.getByRole('button', { name: '完成 離線測試散步', exact: true }).click()
  await stop.getByText('旅記與照片', { exact: true }).click()
  await stop.getByRole('textbox', { name: '離線測試散步 旅行筆記', exact: true }).fill('離線前記下的秋天')
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; c.getContext('2d')!.fillRect(0, 0, 20, 20); return c.toDataURL().split(',')[1] })
  await stop.locator('input[type=file]').setInputFiles({ name: 'offline-photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(stop.getByRole('img', { name: 'offline-photo.png', exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.fonts.check('16px Huninn'))).toBe(true)
  await expect(stop.getByRole('button', { name: '完成 離線測試散步', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await stop.getByText('旅記與照片', { exact: true }).click()
  await expect(stop.getByRole('textbox', { name: '離線測試散步 旅行筆記', exact: true })).toHaveValue('離線前記下的秋天')
  await expect(stop.getByRole('img', { name: 'offline-photo.png', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: '主導覽' }).getByRole('link', { name: '指南 Guide', exact: true }).click()
  for (const id of ['platforms', 'prepare', 'airport', 'cash']) {
    const chapter = page.locator(`#tax-${id}`)
    await chapter.evaluate((el: HTMLDetailsElement) => { el.open = true })
    await chapter.locator('.tax-image-button').click()
    const dialog = page.getByRole('dialog')
    await expect.poll(() => dialog.locator('.media-scroll img').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1080)
    await dialog.getByRole('button', { name: '放大圖片', exact: true }).click()
    await expect(dialog.locator('output')).toHaveText('150%')
    await page.keyboard.press('Escape')
  }
  for(const name of ['鶴羽 TSURUHA DRUG','Bic Camera','Sundrug','JINS','KokuMiN Drug','LOTTE DUTY FREE GINZA']) {
    await page.getByRole('button',{name:`查看 ${name} 優惠券`,exact:true}).click()
    const dialog=page.getByRole('dialog');await expect.poll(()=>dialog.locator('.media-scroll img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(100)
    await dialog.getByRole('button',{name:'關閉',exact:true}).click()
  }
  const donki=page.getByRole('link',{name:'唐吉訶德 DON DON DONKI 開啟官方免稅優惠券',exact:true})
  await expect(donki).toHaveAttribute('aria-disabled','true');await expect(donki).toContainText('此優惠券需要網路連線');await donki.click({force:true});expect(page.context().pages()).toHaveLength(1)
  const packed = page.getByLabel('護照', { exact: true })
  await packed.check()
  await page.reload()
  await expect(packed).toBeChecked()
  await page.getByRole('navigation', { name: '主導覽' }).getByRole('link', { name: '天氣 Weather', exact: true }).click()
  await expect(page.locator('.pwa-offline')).toBeVisible()
  await expect(page.locator('.current-unavailable')).toBeVisible()
})

test('私人連結與 API 回應不進入快取', async ({ page }) => {
  await ready(page)
  const token = 'e'.repeat(64)
  await page.goto(`./?join=${token}#guide`)
  await expect(page.getByRole('heading', { name: '旅行手冊', exact: true })).toBeVisible()
  expect(await page.evaluate(async () => (await fetch('./private-ledger.json', { headers: { Authorization: 'Bearer test-only' } })).json())).toEqual({ testOnly: 'private-response-never-cache' })
  expect(await page.evaluate(async () => (await fetch('https://pwa-test.supabase.co/rest/v1/ledger')).json())).toEqual({ testOnly: 'cloud-response-never-cache' })
  await page.evaluate(async () => { try { await fetch('https://api.open-meteo.com/v1/forecast?private-test=1') } catch { /* intentional no-network fixture */ } })
  const entries = await cacheEntries(page)
  expect(entries.length).toBeGreaterThan(10)
  expect(entries.every(url => url.startsWith('http://127.0.0.1:4181/sendai-trip-planner/') && !new URL(url).search)).toBe(true)
  expect(entries.join('\n')).not.toMatch(/private-ledger|join=|book=|auth\/|open-meteo|supabase|eeeeeeee/)
})

test('手動更新前不重新載入，更新保留本機內容與其他應用快取', async ({ page, request }) => {
  await ready(page)
  await page.evaluate(async () => { localStorage.setItem('pwa-update-retain', 'keep-this'); await (await caches.open('another-app-keep')).put('/another-app.txt', new Response('untouched')) })
  await page.getByRole('navigation', { name: '主導覽' }).getByRole('link', { name: '指南 Guide', exact: true }).click()
  await page.getByLabel('住宿名稱', { exact: true }).fill('更新前的飯店名稱')
  await request.post('/__pwa-test__/control?revision=aaaaaaaaaaaaaaaa')
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update() })
  const update = page.getByRole('button', { name: '更新並重新載入', exact: true })
  await expect(update).toBeVisible()
  await page.evaluate(() => { (window as Window & { pwaReloadMarker?: string }).pwaReloadMarker = 'still-open' })
  const dialog = await openHelp(page)
  await dialog.getByRole('button', { name: '關閉', exact: true }).click()
  expect(await page.evaluate(() => (window as Window & { pwaReloadMarker?: string }).pwaReloadMarker)).toBe('still-open')
  page.once('dialog', dialog => dialog.accept())
  const firstReload = page.waitForEvent('domcontentloaded')
  await update.click()
  await firstReload
  expect(await page.evaluate(() => (window as Window & { pwaReloadMarker?: string }).pwaReloadMarker ?? '')).toBe('')
  await expect(page.getByLabel('住宿名稱', { exact: true })).toHaveValue('更新前的飯店名稱')
  expect(await page.evaluate(() => localStorage.getItem('pwa-update-retain'))).toBe('keep-this')
  expect(await page.evaluate(async () => (await (await caches.open('another-app-keep')).match('/another-app.txt'))?.text())).toBe('untouched')
  const help = await openHelp(page)
  await expect(help.locator('[data-pwa-version]')).toHaveAttribute('data-pwa-version', 'aaaaaaaaaaaaaaaa')
  await help.getByRole('button', { name: '關閉', exact: true }).click()
  await request.post('/__pwa-test__/control?revision=cccccccccccccccc')
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update() })
  await expect(update).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  const secondReload = page.waitForEvent('domcontentloaded')
  await update.click()
  await secondReload
  const newest = await openHelp(page)
  await expect(newest.locator('[data-pwa-version]')).toHaveAttribute('data-pwa-version', 'cccccccccccccccc')
  expect(await page.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('sendai-shell-')).length)).toBe(2)
  expect(await page.evaluate(async () => caches.has('another-app-keep'))).toBe(true)
})

test('新版下載不完整時仍保留可離線開啟的舊版', async ({ page, request, context }) => {
  await ready(page)
  await page.getByRole('navigation', { name: '主導覽' }).getByRole('link', { name: '指南 Guide', exact: true }).click()
  await page.getByLabel('住宿名稱', { exact: true }).fill('舊版離線內容仍保留')
  const before = await page.evaluate(async () => caches.keys())
  await request.post('/__pwa-test__/control?revision=bbbbbbbbbbbbbbbb&blocked=tax-refund/04-cash-refund.jpg')
  const result = await page.evaluate(async () => {
    const reg = (await navigator.serviceWorker.getRegistration())!
    await reg.update()
    const worker = reg.installing
    if (!worker) return 'no-installing-worker'
    if (!['redundant', 'installed'].includes(worker.state)) await new Promise<void>(resolve => worker.addEventListener('statechange', () => { if (['redundant', 'installed'].includes(worker.state)) resolve() }))
    return worker.state
  })
  expect(result).toBe('redundant')
  expect(await page.evaluate(async () => caches.keys())).toEqual(before)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByLabel('住宿名稱', { exact: true })).toHaveValue('舊版離線內容仍保留')
  const help = await openHelp(page)
  await expect(help.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready')
})

test('快取下載失敗可恢復，修復不清除旅遊資料', async ({ page, request }) => {
  await request.post('/__pwa-test__/control?blocked=tax-refund/04-cash-refund.jpg')
  await page.goto('./#guide')
  await page.getByLabel('住宿名稱', { exact: true }).fill('下載失敗仍保留')
  const failed = await openHelp(page, 'error')
  await failed.getByRole('button', { name: '關閉', exact: true }).click()
  await request.post('/__pwa-test__/control')
  await page.reload()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  const help = await openHelp(page)
  await help.getByRole('button', { name: '關閉', exact: true }).click()
  await page.evaluate(async () => {
    for (const name of await caches.keys()) if (name.startsWith('sendai-shell-')) await (await caches.open(name)).delete(new URL('tax-refund/04-cash-refund.jpg', location.href).href)
  })
  const repair = await openHelp(page, 'error')
  await repair.getByRole('button', { name: '重新準備離線內容', exact: true }).click()
  await expect(repair.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready')
  await repair.getByRole('button', { name: '關閉', exact: true }).click()
  await expect(page.getByLabel('住宿名稱', { exact: true })).toHaveValue('下載失敗仍保留')
})
