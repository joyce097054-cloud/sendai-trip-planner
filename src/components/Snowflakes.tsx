import { useEffect, useState } from 'react'

export default function Snowflakes() {
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem('sendai-snow-animation') === 'on' } catch { return false } })
  const [hidden, setHidden] = useState(document.hidden)
  const [error, setError] = useState('')
  useEffect(() => { const update = () => setHidden(document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update) }, [])
  return <><label className="maple-toggle snow-toggle"><input type="checkbox" checked={enabled} onChange={e => { const next = e.target.checked; setEnabled(next); try { localStorage.setItem('sendai-snow-animation', next ? 'on' : 'off'); setError('') } catch { setError('飄雪偏好無法保存，此次仍可切換。') } }}/>繪本飄雪<span className="snow-setting-note">依系統減少動態效果設定暫停</span></label>{error && <small role="status">{error}</small>}{enabled && <div className="snow-layer" data-paused={hidden} aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} style={{ left: `${8 + i * 17}%`, animationDelay: `${-i * 4}s`, animationDuration: `${22 + i * 3}s` }}><svg viewBox="0 0 24 24"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>)}</div>}</>
}
