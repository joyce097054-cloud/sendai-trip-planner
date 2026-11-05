import { useEffect, useState } from 'react'
import { Cloud, CloudLightning, CloudRain, ExternalLink, RefreshCw, Snowflake, Sun, Sunrise, Sunset, Thermometer, Umbrella } from 'lucide-react'
import { clothingAdvice, fetchForecast, locations, tripDates, weatherLabel } from '../lib/weather'
import type { DailyWeather, Forecast, LocationKey } from '../lib/weather'

const icons = { sun: Sun, cloud: Cloud, rain: CloudRain, snow: Snowflake, storm: CloudLightning }
const temperature = (value: number | null) => value === null ? '—' : `${Math.round(value)}°`

function ForecastCard({ day }: { day: DailyWeather }) {
  const { label, icon } = weatherLabel(day.code)
  const Icon = icons[icon]
  return <article className="weather-card panel">
    <div className="section-heading"><h3>{day.date.slice(5).replace('-', '/')}</h3><Icon size={28} aria-hidden="true" /></div>
    <p>{label}</p>
    <p className="weather-temperature"><strong>{temperature(day.high)}</strong> <span className="muted">/ {temperature(day.low)}</span></p>
    <p className="muted"><Thermometer size={15} aria-hidden="true" /> 體感 {temperature(day.feelsLow)}～{temperature(day.feelsHigh)}</p>
    <p className="muted"><Umbrella size={15} aria-hidden="true" /> 降雨機率 {day.rain === null ? '資料暫缺' : `${day.rain}%`}</p>
    <p className="muted"><Sunrise size={15} aria-hidden="true" /> {day.sunrise ?? '—'} <Sunset size={15} aria-hidden="true" /> {day.sunset ?? '—'}</p>
    <p className="weather-advice">{clothingAdvice(day)}</p>
  </article>
}

export default function Weather() {
  const [location, setLocation] = useState<LocationKey>('sendai')
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let timedOut = false
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 15000)
    setLoading(true)
    setForecast(null)
    setError('')
    fetchForecast(location, controller.signal).then(value => {
      if (!controller.signal.aborted) setForecast(value)
    }).catch((reason: unknown) => {
      if (timedOut) setError('天氣連線逾時，請檢查網路後重試。')
      else if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '無法取得天氣，請稍後重試。')
    }).finally(() => {
      window.clearTimeout(timeout)
      if (!controller.signal.aborted || timedOut) setLoading(false)
    })
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [location, attempt])

  const uncovered = tripDates.filter(date => !forecast?.days.some(day => day.date === date))
  return <section className="weather-page page-enter">
    <div className="section-heading"><div><p className="eyebrow">WEATHER & SEASONS</p><h2>把好天氣，裝進行李</h2><p className="muted">依天氣慢慢走，留一點彈性給旅行。</p></div><Sun size={30} aria-hidden="true" /></div>
    <div className="location-tabs" role="group" aria-label="天氣地點">
      {(Object.keys(locations) as LocationKey[]).map(key => <button className={`button ${key === location ? 'primary' : ''}`} aria-pressed={key === location} key={key} onClick={() => setLocation(key)}>{locations[key].name}</button>)}
      <button className="icon-button" disabled={loading} aria-label="重新取得天氣" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={18} /></button>
    </div>
    <div className="panel weather-notice"><p><strong>旅行日期：2026/11/20–11/24 · 日本時間</strong></p><p className="muted">Open-Meteo 最多提供未來 16 日的模式預報；遠期結果仍可能調整，出發前請再次確認。</p>
      {forecast && <p className="muted">資料取得時間：{new Date(forecast.fetchedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Tokyo', hour12: false })}（日本時間，非氣象模式發布時間）</p>}
    </div>
    {loading && <p className="panel" role="status">正在取得{locations[location].name}天氣…</p>}
    {error && <div className="panel" role="alert"><p>目前無法取得即時預報：{error}</p><button className="button primary" onClick={() => setAttempt(value => value + 1)}>重新嘗試</button></div>}
    {!loading && forecast?.days.length === 0 && <p className="panel" role="status">天氣來源目前沒有每日資料，請稍後重新取得。</p>}
    <h3 className="weather-subheading">五日旅程預報</h3>
    <div className="weather-grid">{tripDates.map((date, index) => {
      const day = forecast?.days.find(item => item.date === date)
      return day ? <ForecastCard key={date} day={day} /> : <article className="weather-card panel" key={date}><p className="eyebrow">DAY {index + 1}</p><h3>{date.slice(5).replace('-', '/')}</h3><Cloud size={28} aria-hidden="true" /><p>{loading ? '取得中' : error ? '尚未取得預報' : '尚無此日預報'}</p><p className="muted">{error ? '連線恢復後可重新確認。' : '可能尚未進入預報範圍，請於接近出發時查看。'}</p></article>
    })}</div>
    {uncovered.length > 0 && <div className="panel weather-reference"><p className="eyebrow">SEASONAL REFERENCE · 非即時預報</p><h3>晚秋的穿搭備忘</h3><p>季節性定性參考：以洋蔥式穿搭、保暖外套、圍巾及好走的鞋為準備方向；松島海邊與夜間賞楓可多帶一層。實際氣溫、降雨與楓況須依當日資訊調整。</p><p className="muted">此處不是歷史平均值，也不是旅行當日預報。官方歷史氣候數據待確認，暫不提供溫度數字。</p></div>}
    {forecast && forecast.days.some(day => !tripDates.includes(day.date)) && <details className="panel"><summary>查看目前可取得的日期預報（非完整旅行日期）</summary><div className="weather-grid">{forecast.days.filter(day => !tripDates.includes(day.date)).map(day => <ForecastCard key={day.date} day={day} />)}</div></details>}
    <div className="panel"><h3>資料來源與旅前確認</h3><p className="muted">天氣：Open-Meteo 預報 API，溫度單位 °C。數值缺漏以「—」表示；不自行推測積雪、道路或山區雪況。</p><p><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo <ExternalLink size={13} /></a> · <a href="https://www.jma.go.jp/bosai/forecast/" target="_blank" rel="noreferrer">日本氣象廳預報 <ExternalLink size={13} /></a> · <a href="https://www.data.jma.go.jp/stats/etrn/" target="_blank" rel="noreferrer">氣象廳歷史氣候 <ExternalLink size={13} /></a></p></div>
  </section>
}
