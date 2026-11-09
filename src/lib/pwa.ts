import { useEffect, useRef, useState } from 'react'

type OfflineState = 'checking' | 'ready' | 'unavailable' | 'error' | 'development' | 'portable'
interface CacheStatus { ready: boolean; version: string }
export function isPortable() { return Boolean((globalThis as typeof globalThis & { __SENDAI_PORTABLE__?: boolean }).__SENDAI_PORTABLE__) || location.protocol === 'file:' }
function cacheStatus(worker: ServiceWorker, prepare = false): Promise<CacheStatus> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('Offline status unavailable')) }, 5000)
    channel.port1.onmessage = event => {
      clearTimeout(timeout); channel.port1.close()
      const data = event.data as Partial<CacheStatus> | undefined
      if (typeof data?.ready === 'boolean' && typeof data.version === 'string' && /^[a-f0-9]{16}$/.test(data.version)) resolve(data as CacheStatus)
      else reject(new Error('Invalid offline status'))
    }
    worker.postMessage({ type: prepare ? 'PREPARE_OFFLINE' : 'CACHE_STATUS' }, [channel.port2])
  })
}

export function usePwa() {
  const [offlineState, setOfflineState] = useState<OfflineState>('checking')
  const [version, setVersion] = useState(''), [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [online, setOnline] = useState(navigator.onLine), [installed, setInstalled] = useState(false)
  const [checking, setChecking] = useState(false), [message, setMessage] = useState('')
  const registration = useRef<ServiceWorkerRegistration | null>(null), requestedUpdate = useRef(false)

  useEffect(() => {
    const query = window.matchMedia('(display-mode: standalone)')
    const mode = () => setInstalled(query.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    const up = () => setOnline(true), down = () => setOnline(false)
    mode(); query.addEventListener('change', mode)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { query.removeEventListener('change', mode); window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  useEffect(() => {
    if (isPortable()) { setOfflineState('portable'); return }
    if (!import.meta.env.PROD) { setOfflineState('development'); return }
    if (!('serviceWorker' in navigator) || !window.isSecureContext) { setOfflineState('unavailable'); return }
    let alive = true, reg: ServiceWorkerRegistration | undefined, lastCheck = 0
    const watched = new Set<ServiceWorker>()
    const inspect = () => {
      if (!alive || !reg) return
      setWaiting(reg.waiting && reg.active && navigator.serviceWorker.controller ? reg.waiting : null)
      if (!reg.active && [...watched].some(worker => worker.state === 'redundant')) setOfflineState('error')
      if (reg.active?.state === 'activated') void cacheStatus(reg.active).then(status => {
        if (alive) { setOfflineState(status.ready ? 'ready' : 'error'); setVersion(status.version) }
      }).catch(() => { if (alive) setOfflineState('error') })
      if (reg.installing && !watched.has(reg.installing)) {
        watched.add(reg.installing); reg.installing.addEventListener('statechange', inspect)
      }
    }
    const changed = () => { if (requestedUpdate.current) location.reload(); else inspect() }
    const checkOnReturn = () => {
      if (!reg || !navigator.onLine || document.visibilityState !== 'visible' || Date.now() - lastCheck < 15 * 60000) return
      lastCheck = Date.now(); void reg.update().then(inspect).catch(() => {})
    }
    navigator.serviceWorker.addEventListener('controllerchange', changed)
    document.addEventListener('visibilitychange', checkOnReturn); window.addEventListener('online', checkOnReturn)
    const base = new URL(import.meta.env.BASE_URL, location.href)
    void navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname, updateViaCache: 'none' }).then(value => {
      if (!alive) return
      reg = value; registration.current = value
      value.addEventListener('updatefound', inspect); inspect()
      lastCheck = Date.now(); void value.update().catch(() => {})
      void navigator.serviceWorker.ready.then(() => { if (alive) inspect() })
    }).catch(() => { if (alive) setOfflineState('error') })
    return () => {
      alive = false
      reg?.removeEventListener('updatefound', inspect)
      for (const worker of watched) worker.removeEventListener('statechange', inspect)
      navigator.serviceWorker.removeEventListener('controllerchange', changed)
      document.removeEventListener('visibilitychange', checkOnReturn); window.removeEventListener('online', checkOnReturn)
    }
  }, [])

  async function checkUpdate() {
    const reg = registration.current
    if (!reg || !navigator.onLine || checking) { if (!navigator.onLine) setMessage('目前離線，連線後再檢查更新。'); return }
    setChecking(true); setMessage('')
    try {
      await reg.update()
      setWaiting(reg.waiting && reg.active && navigator.serviceWorker.controller ? reg.waiting : null)
      if (!reg.waiting) setMessage('已檢查更新；若有新版，下載完成後會顯示提示。')
      if (reg.active?.state === 'activated') {
        const status = await cacheStatus(reg.active)
        setOfflineState(status.ready ? 'ready' : 'error'); setVersion(status.version)
      }
    } catch { setMessage('暫時無法檢查更新，可以繼續使用目前版本，稍後再試。') }
    finally { setChecking(false) }
  }
  async function verifyOffline() {
    const worker = registration.current?.active
    if (!worker || worker.state !== 'activated') return
    try {
      const status = await cacheStatus(worker)
      setOfflineState(status.ready ? 'ready' : 'error'); setVersion(status.version)
    } catch { setOfflineState('error') }
  }
  async function prepareOffline() {
    const worker = registration.current?.active
    if (!worker || !navigator.onLine || checking) return
    setChecking(true); setOfflineState('checking'); setMessage('')
    try {
      const status = await cacheStatus(worker, true)
      setOfflineState(status.ready ? 'ready' : 'error'); setVersion(status.version)
    } catch { setOfflineState('error') }
    finally { setChecking(false) }
  }
  function applyUpdate() {
    const worker = registration.current?.waiting
    if (!worker || !confirm('更新會重新載入此頁，請先儲存編輯中的內容。現在更新？')) return
    requestedUpdate.current = true
    worker.postMessage({ type: 'SKIP_WAITING' })
  }
  return { offlineState, version, waiting, online, installed, checking, message, checkUpdate, applyUpdate, verifyOffline, prepareOffline }
}
export type PwaState = ReturnType<typeof usePwa>
