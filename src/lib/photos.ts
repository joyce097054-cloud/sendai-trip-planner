import type { Photo } from '../types'
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sendai-photos', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('照片儲存空間無法開啟，請確認瀏覽器允許儲存資料。'))
  })
}
export async function getPhotos(): Promise<Photo[]> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly')
    const request = tx.objectStore('photos').getAll()
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onerror = () => { db.close(); reject(new Error('讀取照片失敗')) }
  })
}
export async function changePhotos(add: Photo[] = [], remove: string[] = [], replace = false) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite')
    const store = tx.objectStore('photos')
    if (replace) store.clear()
    remove.forEach(id => store.delete(id))
    add.forEach(photo => store.put(photo))
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('照片儲存失敗，可能已超過裝置容量。請先匯出備份。')) }
  })
}
export async function compressPhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('請選擇 JPG、PNG 或 WebP 照片。')
  if (file.size > 20 * 1024 * 1024) throw new Error('單張照片請小於 20 MB。')
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法處理照片')), 'image/jpeg', .82))
}
