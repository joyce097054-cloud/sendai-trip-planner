import { describe, expect, it } from 'vitest'
import { clothingAdvice, parseForecast, weatherLabel } from './weather'

describe('weather data boundaries', () => {
  it('preserves missing values instead of presenting them as zero', () => {
    const [day] = parseForecast({ daily: { time: ['2026-11-20'], temperature_2m_max: [null], precipitation_probability_max: [null] } })
    expect(day.high).toBeNull()
    expect(day.rain).toBeNull()
    expect(day.sunrise).toBeNull()
  })
  it('rejects malformed responses and does not make up dates', () => {
    expect(() => parseForecast({ error: true })).toThrow()
    expect(() => parseForecast({ daily: { time: ['bad-date'] } })).toThrow()
    expect(parseForecast({ daily: { time: [] } })).toEqual([])
  })
  it('uses API dates, times and rain probability without extending coverage', () => {
    const days = parseForecast({ daily: { time: ['2026-11-20'], temperature_2m_max: [13.4], precipitation_probability_max: [150], sunrise: ['2026-11-20T06:22'] } })
    expect(days).toHaveLength(1)
    expect(days[0].sunrise).toBe('06:22')
    expect(days[0].rain).toBeNull()
    expect(days[0].high).toBe(13.4)
  })
  it('only indicates snow when weather code provides a snow forecast', () => {
    expect(weatherLabel(null).label).toBe('天氣狀態暫缺')
    expect(weatherLabel(71).icon).toBe('snow')
    expect(weatherLabel(61).icon).toBe('rain')
  })
  it('adapts clothing suggestions to cold and rain', () => {
    const [day] = parseForecast({ daily: { time: ['2026-11-20'], temperature_2m_min: [5], precipitation_probability_max: [70] } })
    expect(clothingAdvice(day)).toContain('圍巾')
    expect(clothingAdvice(day)).toContain('折傘')
  })
})
