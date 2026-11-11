import { MapPin } from 'lucide-react'
import SendaiStory from './SendaiStory'

export default function TripHeader({ compact, status, hotel }: { compact: boolean; status: string; hotel: string }) {
  return <section className={`trip-header ${compact ? 'trip-header-compact' : ''}`} aria-label="仙台旅行資訊">
    <div className="trip-heading">
      {!compact && <p className="eyebrow">SENDAI · A LITTLE AUTUMN ADVENTURE</p>}
      <h1>仙台賞楓五日自由行</h1>
      <div className="trip-dates"><time dateTime="2026-11-20">2026.11.20</time><span aria-hidden="true">—</span><time dateTime="2026-11-24">11.24</time><span className="countdown">{status}</span></div>
      {!compact && <p className="trip-caption"><MapPin size={14} aria-hidden="true"/>仙台・松島・岩沼 <span>大眾運輸與步行</span></p>}
    </div>
    {!compact && <div className="story-art"><SendaiStory/><span className="story-caption">和小狐狸一起，把秋天收進手帳。</span></div>}
    {!compact && <p className="trip-hotel">STAY <span>{hotel}</span></p>}
  </section>
}
