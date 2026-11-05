import { describe, expect, it } from 'vitest'
import type { Stop } from '../types'
import { directionUrl, mapUrl, routeUrl } from './maps'

function destination(name: string, mapQuery = ''): Stop {
  return { id: name, day: 1, start: '', end: '', name, japanese: '', category: '景點', description: '', duration: '', transport: '', tags: [], photoTip: '', notes: '', done: false, mapQuery }
}

describe('public transport and walking map links', () => {
  it('safely encodes Chinese, Japanese and reserved query characters', () => {
    const query = '仙台駅 & café #1?'
    const url = new URL(mapUrl(query))
    expect(url.origin).toBe('https://www.google.com')
    expect(url.searchParams.get('query')).toBe(query)
    expect(url.searchParams.get('api')).toBe('1')
    expect(url.hash).toBe('')
    expect([...url.searchParams.keys()]).toEqual(['api', 'query'])
  })
  it('defaults directions to public transit and allows walking', () => {
    expect(new URL(directionUrl('松島海岸')).searchParams.get('travelmode')).toBe('transit')
    const walking = new URL(directionUrl('瑞鳳殿', 'walking'))
    expect(walking.searchParams.get('travelmode')).toBe('walking')
    expect(walking.searchParams.get('destination')).toBe('瑞鳳殿')
  })
  it('handles empty and single-stop days without generating broken multi-stop routes', () => {
    expect(routeUrl([])).toBe('')
    expect(routeUrl([destination('仙台駅')])).toBe(mapUrl('仙台駅'))
    expect(routeUrl([destination('飯店', 'Hotel Keihan Sendai')])).toBe(mapUrl('Hotel Keihan Sendai'))
  })
  it('uses the selected order for the first transit leg and avoids unsupported waypoints', () => {
    const stops = [destination('飯店', 'Hotel Keihan Sendai'), destination('瑞鳳殿'), destination('仙台駅')]
    const url = new URL(routeUrl(stops))
    expect(url.searchParams.get('origin')).toBe('Hotel Keihan Sendai')
    expect(url.searchParams.get('destination')).toBe('瑞鳳殿')
    expect(url.searchParams.get('travelmode')).toBe('transit')
    expect(url.searchParams.has('waypoints')).toBe(false)
    const reversed = new URL(routeUrl([...stops].reverse()))
    expect(reversed.searchParams.get('origin')).toBe('仙台駅')
  })
})
