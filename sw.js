/* Generated into dist/sw.js. Only the explicit project asset list is cached. */
const VERSION = '15213b8deb00e96a'
const ASSETS = ["assets/index-DcVnKv-C.css","assets/index-zUNCLVWE.js","coupons/bic-camera.png","coupons/donki-logo.jpg","coupons/jins.jpg","coupons/kokumin.jpg","coupons/lotte-ginza.jpg","coupons/sundrug.png","coupons/tsuruha.png","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/journal.svg","index.html","manifest.webmanifest","sendai-autumn.svg","tax-refund/01-platforms.jpg","tax-refund/02-prepare-home-screen.jpg","tax-refund/03-vjw-kiosk.jpg","tax-refund/04-cash-refund.jpg"]
const SCOPE = self.registration.scope
const PREFIX = `sendai-shell-${encodeURIComponent(new URL(SCOPE).pathname)}-`
const CACHE = PREFIX + VERSION
const INDEX = new URL('index.html', SCOPE).href
const SAFE = new Set(ASSETS.map(path => new URL(path, SCOPE).href))

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    try {
      await cache.addAll([...SAFE].map(url => new Request(url, { cache: 'reload', credentials: 'same-origin' })))
    } catch (error) {
      await caches.delete(CACHE)
      throw error
    }
    // Wait for the user or a normal restart; never interrupt an open form.
  })())
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const older = (await caches.keys()).filter(name => name.startsWith(PREFIX) && name !== CACHE)
    // Retain the previous shell for other open tabs. Never clear app storage,
    // photos, auth sessions or caches belonging to another app/scope.
    await Promise.all(older.slice(0, -1).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url), scope = new URL(SCOPE)
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return
  const navigation = request.mode === 'navigate' && (url.pathname === scope.pathname || url.href.split('?')[0] === INDEX)
  if (navigation) {
    // Normalize all navigation to the public shell key. Invite query strings
    // and fragments are never used as Cache Storage keys.
    event.respondWith((async () => (await caches.open(CACHE)).match(INDEX).then(cached => cached || fetch(request)))())
    return
  }
  if (url.search) return
  const historicalAsset = url.pathname.startsWith(new URL('assets/', SCOPE).pathname)
  if (!SAFE.has(url.href) && !historicalAsset) return
  event.respondWith((async () => {
    const current = await (await caches.open(CACHE)).match(url.href)
    if (current) return current
    if (historicalAsset) {
      const previous = (await caches.keys()).filter(name => name.startsWith(PREFIX) && name !== CACHE)
      for (const name of previous.reverse()) {
        const cached = await (await caches.open(name)).match(url.href)
        if (cached) return cached
      }
    }
    return fetch(request) // Never dynamically cache responses.
  })())
})
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting())
  if (['CACHE_STATUS', 'PREPARE_OFFLINE'].includes(event.data?.type) && event.ports[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE)
      if (event.data.type === 'PREPARE_OFFLINE') {
        try { await cache.addAll([...SAFE].map(url => new Request(url, { cache: 'reload', credentials: 'same-origin' }))) }
        catch { event.ports[0].postMessage({ ready: false, version: VERSION }); return }
      }
      const ready = (await Promise.all([...SAFE].map(url => cache.match(url)))).every(Boolean)
      event.ports[0].postMessage({ ready, version: VERSION })
    })())
  }
})
