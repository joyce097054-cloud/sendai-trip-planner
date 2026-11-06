import { useEffect, useState } from 'react'
import { Cloud, CloudLightning, CloudRain, Moon, RefreshCw, Snowflake, Sun, Sunrise, Sunset, Thermometer, Umbrella } from 'lucide-react'
import { clothingAdvice, currentIsFresh, fetchForecast, locations, tripDates, weatherLabel } from '../lib/weather'
import type { CurrentWeather, DailyWeather, Forecast, LocationKey } from '../lib/weather'
import PageHeading from './ui/PageHeading'

const icons = { sun: Sun, cloud: Cloud, rain: CloudRain, snow: Snowflake, storm: CloudLightning }
const temperature = (value: number | null) => value === null ? '—' : `${Math.round(value)}°`
function WeatherIcon({ code, night = false, size = 28 }: { code: number | null; night?: boolean; size?: number }) {
  const type = weatherLabel(code).icon
  const Icon = type === 'sun' && night ? Moon : icons[type]
  return <Icon size={size} strokeWidth={1.4} aria-hidden="true"/>
}
function CurrentConditions({ current, location, loading, error, now }: { current: CurrentWeather | null; location: LocationKey; loading: boolean; error: string; now: number }) {
  const fresh = current && currentIsFresh(current, now)
  return <section className="current-weather" aria-labelledby="current-weather-title">
    <div className="current-heading"><h3 id="current-weather-title">{locations[location].name}現在</h3><span className="data-state" data-state={loading ? 'loading' : fresh ? 'current' : current ? 'stale' : 'missing'}>{loading ? '取得中' : fresh ? '即時・模式估計' : current ? '最近資料・非即時' : '尚未取得'}</span></div>
    {current ? <><div className="current-reading"><strong>{temperature(current.temperature)}<small>C</small></strong><div><WeatherIcon code={current.code} night={current.isDay === false} size={50}/><p>{weatherLabel(current.code).label}</p></div></div><p className="current-feels">體感 {temperature(current.feelsLike)}</p><p className="source-date">資料時間：<time dateTime={`${current.time}+09:00`}>{current.time.replace('T', ' ')}</time>（日本時間）</p></> : <div className="current-unavailable"><strong>—</strong><p>{loading ? '正在取得目前天氣…' : error ? '連線恢復後，請重新取得天氣。' : '天氣來源尚未提供目前天氣資料。'}</p></div>}
    <p className="muted small">目前天氣來自 Open-Meteo 模式估計，非測站實測；不以每日預報代替目前溫度。</p>
  </section>
}
function ForecastCard({ day, index }: { day: DailyWeather; index?: number }) {
  const weekday = new Intl.DateTimeFormat('zh-TW', { weekday: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(`${day.date}T12:00:00+09:00`))
  return <article className="weather-card">
    <div className="forecast-row"><div className="forecast-date"><time dateTime={day.date}>{day.date.slice(5).replace('-', '/')}</time><span>{index === undefined ? weekday : `DAY ${index + 1} · ${weekday}`}</span></div><div className="forecast-condition"><WeatherIcon code={day.code}/><span>{weatherLabel(day.code).label}</span></div><p className="weather-temperature"><strong>{temperature(day.high)}</strong><span>{temperature(day.low)}</span></p><p className="forecast-rain"><Umbrella size={15} aria-hidden="true"/><span>降雨機率 {day.rain === null ? '資料暫缺' : `${day.rain}%`}</span></p></div>
    <details className="forecast-details"><summary>穿搭與日出日落</summary><div><p><Thermometer size={15} aria-hidden="true"/>體感 {temperature(day.feelsLow)}～{temperature(day.feelsHigh)}</p><p><Sunrise size={15} aria-hidden="true"/>日出 {day.sunrise ?? '—'}<Sunset size={15} aria-hidden="true"/>日落 {day.sunset ?? '—'}</p><p className="weather-advice">{clothingAdvice(day)}</p></div></details>
  </article>
}

export default function Weather({ location, setLocation }: { location: LocationKey; setLocation: (location: LocationKey) => void }) {
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0), [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    const controller = new AbortController()
    let timedOut = false
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 15000)
    setLoading(true); setForecast(null); setError('')
    fetchForecast(location, controller.signal).then(value => {
      if (!controller.signal.aborted) { setForecast(value); setNow(Date.now()) }
    }).catch((reason: unknown) => {
      if (timedOut) setError('天氣連線逾時，請檢查網路後重試。')
      else if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '無法取得天氣，請稍後重試。')
    }).finally(() => { window.clearTimeout(timeout); if (!controller.signal.aborted || timedOut) setLoading(false) })
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [location, attempt])

  const uncovered = tripDates.filter(date => !forecast?.days.some(day => day.date === date))
  return <section className="weather-page">
    <PageHeading title="旅途天氣"><span className="reading-note">日本時間 · °C</span></PageHeading>
    <div className="location-tabs" role="group" aria-label="天氣地點">{(Object.keys(locations) as LocationKey[]).map(key => <button aria-pressed={key === location} key={key} onClick={() => setLocation(key)}>{locations[key].name}</button>)}<button className="icon-button" disabled={loading} aria-label="重新取得天氣" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={19} aria-hidden="true"/></button></div>
    {error && <div className="notice error-notice" role="alert"><p>目前無法取得天氣資料：{error}</p><button className="button" onClick={() => setAttempt(value => value + 1)}>重新嘗試</button></div>}
    <CurrentConditions current={forecast?.current ?? null} location={location} loading={loading} error={error} now={now}/>
    <div className="forecast-heading"><h3>五日旅程預報</h3><span className="data-state">預報</span></div><p className="muted small">2026/11/20–11/24 · 高溫／低溫</p>
    <div className="weather-grid">{tripDates.map((date, index) => {
      const day = forecast?.days.find(item => item.date === date)
      return day ? <ForecastCard key={date} day={day} index={index}/> : <article className="weather-card forecast-unavailable" key={date}><div className="forecast-date"><time dateTime={date}>{date.slice(5).replace('-', '/')}</time><span>DAY {index + 1}</span></div><Cloud size={23} strokeWidth={1.4} aria-hidden="true"/><div><p>{loading ? '取得中' : error ? '尚未取得預報' : '尚無此日預報'}</p><p className="muted small">{error ? '連線恢復後可重新確認。' : '接近出發時，再確認當日預報。'}</p></div></article>
    })}</div>
    {!loading && forecast?.days.length === 0 && <p className="notice" role="status">天氣來源目前沒有每日資料，請稍後重新取得。</p>}
    {forecast && <p className="source-date">資料取得時間：{new Date(forecast.fetchedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Tokyo', hour12: false })}（日本時間，非氣象模式發布時間）</p>}
    <p className="muted small">Open-Meteo 最多提供未來 16 日的模式預報；遠期結果可能調整，出發前請再次確認。</p>
    {uncovered.length > 0 && <aside className="weather-reference"><p className="eyebrow">SEASONAL REFERENCE · 非即時預報</p><h3>晚秋的穿搭備忘</h3><p>季節性定性參考：以洋蔥式穿搭、保暖外套、圍巾及好走的鞋為準備方向；松島海邊與夜間賞楓可多帶一層。實際氣溫、降雨與楓況須依當日資訊調整。</p><p className="muted small">此處不是歷史平均值，也不是旅行當日預報。官方歷史氣候數據待確認，暫不提供溫度數字。</p></aside>}
    {forecast && forecast.days.some(day => !tripDates.includes(day.date)) && <details className="other-forecast"><summary>查看目前可取得的日期預報（非完整旅行日期）</summary><div className="weather-grid">{forecast.days.filter(day => !tripDates.includes(day.date)).map(day => <ForecastCard key={day.date} day={day}/>)}</div></details>}
    <details className="weather-sources"><summary>資料來源與旅前確認</summary><p>天氣：Open-Meteo 預報 API，溫度單位 °C。缺漏以「—」表示；不自行推測積雪、道路或山區雪況。</p><p>目前天氣時間超過 30 分鐘或異常晚於裝置時間時，標示為最近資料，不當作即時狀態。</p><div className="source-links"><a className="source-link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a><a className="source-link" href="https://www.jma.go.jp/bosai/forecast/" target="_blank" rel="noreferrer">日本氣象廳預報</a><a className="source-link" href="https://www.data.jma.go.jp/stats/etrn/" target="_blank" rel="noreferrer">氣象廳歷史氣候</a></div></details>
  </section>
}
