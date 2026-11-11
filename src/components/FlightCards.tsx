import { ArrowUpRight, Plane } from 'lucide-react'
import type { TravelDetails } from '../types'

export default function FlightCards({ details }: { details: TravelDetails }) {
  return <section className="flight-section" aria-label="旅行航班">
    <div className="section-heading"><h2><Plane size={20} aria-hidden="true"/> 飛往秋天的小旅行</h2><a className="text-button" href="#guide">編輯旅行資料<ArrowUpRight size={14}/></a></div>
    <div className="flight-cards">{([{ key: 'outbound', label: '去程', caption: 'HELLO, SENDAI', number: '01' }, { key: 'inbound', label: '回程', caption: 'UNTIL NEXT TIME', number: '02' }] as const).map(f => <article className={`flight-card flight-${f.key}`} key={f.key}>
      <div className="flight-card-heading"><span><Plane size={18} aria-hidden="true"/> {f.label}</span><small>{f.caption}</small></div>
      <p>{details[f.key] || '尚未填寫航班，可至指南編輯。'}</p><span className="flight-ticket-number" aria-hidden="true">{f.number}</span>
    </article>)}</div><p className="flight-note">皆為當地時間，請以航空公司與訂單為準。</p>
  </section>
}
