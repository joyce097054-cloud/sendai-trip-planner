import plan from './itinerary-2026-11-10.json'
import type { DayInfo, Stop } from '../types'

// User's formal plan, received 2026/11/10. Slots are not verified opening hours.
export const PLAN_REVISION = plan.revision
export const days = plan.days as DayInfo[]
export const defaultStops = plan.stops as Stop[]
export function visibleStops(stops: Stop[], day: number, variant: 'A' | 'B' = 'A') {
  return stops.filter(s => s.day === day && !s.archived && (!s.variant || s.variant === variant))
}
