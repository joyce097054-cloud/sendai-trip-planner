import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppData, Stop } from '../types'
import { isAppData, makeBackup, parseBackup, readData, STORAGE_KEY } from './storage'

function stop(): Stop {
  return { id: 'stop-1', day: 2, start: '09:30', end: '12:00', name: '染髮', japanese: '仙台', category: '活動', description: '尚未預約', duration: '150 分鐘', transport: '步行', tags: [], photoTip: '', notes: '個人筆記', done: true, mapQuery: '仙台中央' }
}
function data(): AppData {
  return { version: 1, stops: [stop()], packing: [{ id: 'bag-1', group: '日本購物清單', name: '筆記本', quantity: 2, done: false }], details: { outbound: 'JX862', inbound: 'JX863', hotel: 'Hotel Keihan Sendai', orderLink: '', notes: '個人住宿備註' } }
}
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2k0AAAAASUVORK5CYII='
function backup() {
  return { format: 'sendai-trip-backup', version: 1, exportedAt: '2026-11-05T00:00:00Z', data: data(), photos: [{ id: 'photo-1', stopId: 'stop-1', caption: '仙台旅記', dataUrl: png }] }
}
afterEach(() => vi.unstubAllGlobals())

describe('local data and backup validation', () => {
  it('accepts edited valid data while rejecting broken app versions and field ranges', () => {
    expect(isAppData(data())).toBe(true)
    expect(isAppData({ ...data(), version: 2 })).toBe(false)
    expect(isAppData({ ...data(), stops: [{ ...stop(), day: 6 }] })).toBe(false)
    expect(isAppData({ ...data(), stops: [{ ...stop(), start: '25:60' }] })).toBe(false)
    expect(isAppData({ ...data(), packing: [{ ...data().packing[0], quantity: -1 }] })).toBe(false)
    expect(isAppData({ ...data(), details: { hotel: '缺少其他欄位' } })).toBe(false)
  })
  it('rejects duplicate stop and packing IDs so edits have an unambiguous target', () => {
    expect(isAppData({ ...data(), stops: [stop(), stop()] })).toBe(false)
    expect(isAppData({ ...data(), packing: [data().packing[0], data().packing[0]] })).toBe(false)
  })
  it('loads valid local data and keeps corrupt storage untouched', () => {
    const getItem = vi.fn().mockReturnValue(JSON.stringify(data()))
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem, setItem })
    expect(readData(data()).data).toEqual(data())
    expect(getItem).toHaveBeenCalledWith(STORAGE_KEY)
    getItem.mockReturnValue('{broken')
    const fallback = data()
    const result = readData(fallback)
    expect(result.data).toBe(fallback)
    expect(result.error).toContain('暫停自動儲存')
    expect(setItem).not.toHaveBeenCalled()
  })
  it('reports blocked local storage rather than falsely claiming saved data loaded', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
    expect(readData(data()).error).not.toBe('')
  })
  it('rejects invalid JSON, formats, versions and app data before importing', async () => {
    await expect(parseBackup('{broken')).rejects.toThrow()
    await expect(parseBackup(JSON.stringify({ ...backup(), format: 'other-app' }))).rejects.toThrow()
    await expect(parseBackup(JSON.stringify({ ...backup(), version: 2 }))).rejects.toThrow()
    await expect(parseBackup(JSON.stringify({ ...backup(), data: { ...data(), stops: [null] } }))).rejects.toThrow()
  })
  it.each(['javascript:alert(1)', 'https://example.com/tracking.jpg', 'data:image/svg+xml;base64,PHN2Zy8+'])('rejects non-raster or external photo URL %s', async dataUrl => {
    const b = backup()
    b.photos[0].dataUrl = dataUrl
    await expect(parseBackup(JSON.stringify(b))).rejects.toThrow('照片格式')
  })
  it('rejects orphaned and duplicate photo IDs', async () => {
    const orphan = backup()
    orphan.photos[0].stopId = 'deleted-stop'
    await expect(parseBackup(JSON.stringify(orphan))).rejects.toThrow('照片格式')
    const duplicate = backup()
    duplicate.photos.push({ ...duplicate.photos[0] })
    await expect(parseBackup(JSON.stringify(duplicate))).rejects.toThrow('重複')
  })
  it.each(['data:image/png;base64,', 'data:image/png;base64,SGVsbG8='])('rejects corrupt image bytes %s', async dataUrl => {
    const b = backup(); b.photos[0].dataUrl = dataUrl
    await expect(parseBackup(JSON.stringify(b))).rejects.toThrow('照片格式')
  })
  it('roundtrips edits, completion, shopping quantities and photo bytes through JSON', async () => {
    class TestFileReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL(blob: Blob) {
        blob.arrayBuffer().then(buffer => {
          this.result = `data:${blob.type};base64,${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`
          this.onload?.()
        }).catch(() => this.onerror?.())
      }
    }
    vi.stubGlobal('FileReader', TestFileReader)
    const imported = await parseBackup(JSON.stringify(backup()))
    const serialized = JSON.stringify(await makeBackup(imported.data, imported.photos))
    const restored = await parseBackup(serialized)
    expect(restored.data).toEqual(data())
    expect(restored.photos[0].caption).toBe('仙台旅記')
    expect(restored.photos[0].stopId).toBe('stop-1')
    expect(restored.photos[0].blob.type).toBe('image/png')
    expect(await restored.photos[0].blob.arrayBuffer()).toEqual(await imported.photos[0].blob.arrayBuffer())
  })
})
