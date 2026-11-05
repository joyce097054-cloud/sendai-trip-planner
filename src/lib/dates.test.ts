import { expect, it } from 'vitest'
import { tripStatus } from './dates'
it('counts calendar days and uses Japan midnight at travel boundaries', () => {
  expect(tripStatus(new Date('2026-11-05T12:00:00Z'))).toBe('距離出發還有 15 天')
  expect(tripStatus(new Date('2026-11-19T14:59:59Z'))).toBe('距離出發還有 1 天')
  expect(tripStatus(new Date('2026-11-19T15:00:00Z'))).toBe('旅程進行中・第 1 天')
  expect(tripStatus(new Date('2026-11-23T15:00:00Z'))).toBe('旅程進行中・第 5 天')
  expect(tripStatus(new Date('2026-11-24T15:00:00Z'))).toBe('旅程結束，回憶繼續')
})
