import { MapPin } from 'lucide-react'

export default function TripHeader({ compact, status, hotel }: { compact: boolean; status: string; hotel: string }) {
  return <section className={`trip-header ${compact ? 'trip-header-compact' : ''}`} aria-label="仙台旅行資訊">
    <div className="trip-heading">
      {!compact && <p className="eyebrow">MIYAGI, JAPAN · AUTUMN 2026</p>}
      <h1>仙台賞楓五日自由行</h1>
      <div className="trip-dates"><time dateTime="2026-11-20">2026.11.20</time><span aria-hidden="true">—</span><time dateTime="2026-11-24">11.24</time><span className="countdown">{status}</span></div>
      {!compact && <p className="trip-caption"><MapPin size={14} aria-hidden="true"/>仙台・松島・岩沼 <span>大眾運輸與步行</span></p>}
    </div>
    {!compact && <img className="hero-art" src="sendai-autumn.svg" alt="仙台秋日插畫：暖橘楓葉、山巒與日式庭園"/>}
    {!compact && <p className="trip-hotel">STAY <span>{hotel}</span></p>}
  </section>
}
