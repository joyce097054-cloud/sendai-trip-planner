export const tripDates = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24']

export const locations = {
  sendai: { name: '仙台', latitude: 38.2682, longitude: 140.8694 },
  matsushima: { name: '松島', latitude: 38.3734, longitude: 141.061 },
  iwanuma: { name: '岩沼', latitude: 38.1042, longitude: 140.8697 },
} as const
export type LocationKey = keyof typeof locations
export interface DailyWeather {
  date: string
  code: number | null
  high: number | null
  low: number | null
  feelsHigh: number | null
  feelsLow: number | null
  rain: number | null
  sunrise: string | null
  sunset: string | null
}
export interface CurrentWeather { time: string; temperature: number | null; feelsLike: number | null; code: number | null; isDay: boolean | null }
export interface Forecast { days: DailyWeather[]; current: CurrentWeather | null; fetchedAt: string }

function dateKey(value: string) {
  const parsed = Date.parse(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}

export function parseCurrent(value: unknown): CurrentWeather | null {
  const current = object(object(value)?.current)
  if (!current || typeof current.time !== 'string' || !dateKey(current.time.slice(0, 10)) || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(current.time)) return null
  const numeric = (key: string) => typeof current[key] === 'number' && Number.isFinite(current[key]) ? current[key] as number : null
  const temperature = numeric('temperature_2m'), code = numeric('weather_code')
  if (temperature === null && code === null) return null
  return { time: current.time, temperature, feelsLike: numeric('apparent_temperature'), code, isDay: current.is_day === 1 ? true : current.is_day === 0 ? false : null }
}

export function currentIsFresh(current: CurrentWeather, now = Date.now()) {
  const age = now - Date.parse(`${current.time}+09:00`)
  return Number.isFinite(age) && age >= -15 * 60000 && age <= 30 * 60000
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function parseForecast(value: unknown): DailyWeather[] {
  const root = object(value)
  const daily = object(root?.daily)
  if (!daily || !Array.isArray(daily.time)) throw new Error('天氣來源未回傳每日預報，請稍後再試。')
  const numeric = (key: string, index: number) => {
    const list = daily[key]
    const item: unknown = Array.isArray(list) ? list[index] : null
    return typeof item === 'number' && Number.isFinite(item) ? item : null
  }
  const clock = (key: string, index: number) => {
    const list = daily[key]
    const item: unknown = Array.isArray(list) ? list[index] : null
    return typeof item === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(item) ? item.slice(11, 16) : null
  }
  return daily.time.map((date: unknown, index: number) => {
    if (typeof date !== 'string' || !dateKey(date)) throw new Error('天氣來源日期格式異常，請稍後重試。')
    const rain = numeric('precipitation_probability_max', index)
    return {
      date,
      code: numeric('weather_code', index),
      high: numeric('temperature_2m_max', index),
      low: numeric('temperature_2m_min', index),
      feelsHigh: numeric('apparent_temperature_max', index),
      feelsLow: numeric('apparent_temperature_min', index),
      rain: rain !== null && rain >= 0 && rain <= 100 ? rain : null,
      sunrise: clock('sunrise', index),
      sunset: clock('sunset', index),
    }
  })
}

export async function fetchForecast(location: LocationKey, signal?: AbortSignal): Promise<Forecast> {
  const place = locations[location]
  const params = new URLSearchParams({
    latitude: String(place.latitude), longitude: String(place.longitude), timezone: 'Asia/Tokyo', forecast_days: '16',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,sunrise,sunset',
    current: 'temperature_2m,apparent_temperature,is_day,weather_code', temperature_unit: 'celsius',
  })
  let response: Response
  try { response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal }) }
  catch (reason) {
    if (signal?.aborted) throw reason
    throw new Error('無法連接天氣服務，請檢查網路後重試。')
  }
  if (!response.ok) throw new Error(`天氣服務暫時無法使用（HTTP ${response.status}）。請檢查網路後重試。`)
  let json: unknown
  try { json = await response.json() } catch { throw new Error('天氣來源回傳的資料無法讀取，請稍後重試。') }
  return { days: parseForecast(json), current: parseCurrent(json), fetchedAt: new Date().toISOString() }
}

export function weatherLabel(code: number | null): { label: string; icon: 'sun' | 'cloud' | 'rain' | 'snow' | 'storm' } {
  if (code === 0) return { label: '晴朗', icon: 'sun' }
  if (code !== null && [1, 2, 3].includes(code)) return { label: '晴時多雲／多雲', icon: 'cloud' }
  if (code !== null && [45, 48].includes(code)) return { label: '有霧', icon: 'cloud' }
  if (code !== null && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: '有雨', icon: 'rain' }
  if (code !== null && [71, 73, 75, 77, 85, 86].includes(code)) return { label: '降雪預報', icon: 'snow' }
  if (code !== null && [95, 96, 99].includes(code)) return { label: '雷雨', icon: 'storm' }
  return { label: '天氣狀態暫缺', icon: 'cloud' }
}

export function clothingAdvice(day: DailyWeather): string {
  const tips = ['分層穿搭，方便在室內外調整。']
  if (day.low !== null && day.low < 10) tips.push('早晚偏冷，準備保暖外套與圍巾。')
  if (day.high !== null && day.high < 10) tips.push('白天也偏冷，建議保暖內搭。')
  if (day.rain !== null && day.rain >= 40) tips.push('攜帶折傘及防滑、耐雨的步行鞋。')
  return tips.join('')
}
