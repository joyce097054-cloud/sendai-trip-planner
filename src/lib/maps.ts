import type { Stop } from '../types'
export function mapUrl(query: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` }
export function directionUrl(query: string, mode: 'transit' | 'walking' = 'transit') { return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=${mode}` }
export function routeUrl(stops: Stop[]) {
  if (stops.length < 2) return stops[0] ? mapUrl(stops[0].mapQuery || stops[0].name) : ''
  // Transit routes do not support intermediate waypoints. Offer each leg in the UI.
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(stops[0].mapQuery || stops[0].name)}&destination=${encodeURIComponent(stops[1].mapQuery || stops[1].name)}&travelmode=transit`
}
