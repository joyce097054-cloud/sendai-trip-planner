export function tripStatus(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const remaining = Math.round((Date.parse('2026-11-20') - Date.parse(date)) / 86400000)
  return remaining > 0 ? `距離出發還有 ${remaining} 天` : remaining >= -4 ? `旅程進行中・第 ${1 - remaining} 天` : '旅程結束，回憶繼續'
}
