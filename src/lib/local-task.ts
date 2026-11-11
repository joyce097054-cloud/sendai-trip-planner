// A lease spans the whole async operation, including photo compression. This
// keeps an import from clearing photos while an earlier upload is still running.
let active: 'data' | 'photo' | null = null
function acquire(kind: 'data' | 'photo') {
  if (active) throw new Error(active === 'photo' ? '照片仍在處理中，請完成後再備份、更新或還原。' : '資料正在備份、更新或還原，請稍候完成。')
  active = kind
  let released = false
  return () => { if (!released) { released = true; active = null } }
}
export const beginLocalDataTask = () => acquire('data')
export const beginLocalPhotoTask = () => acquire('photo')
export const localDataTaskActive = () => active === 'data'
