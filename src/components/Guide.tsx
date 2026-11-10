import { ExternalLink, Phone, Plane, ChevronDown } from 'lucide-react'
import type { PackingItem, TravelDetails, ShoppingLists as Lists } from '../types'
import { guideInformation } from '../data/guide'
import CouponShelf from './guide/CouponShelf'
import TaxRefundGuide from './guide/TaxRefundGuide'
import PackingList from './guide/PackingList'
import ShoppingLists from '../features/shopping/ShoppingLists'
import SectionIndex from './guide/SectionIndex'
import PageHeading from './ui/PageHeading'
interface Props { packing:PackingItem[];setPacking:(items:PackingItem[])=>void;shopping:Lists;setShopping:(v:Lists)=>void;cloudTrip?:string;setCloudTrip:(id:string|undefined)=>void;details:TravelDetails;setDetails:(d:TravelDetails)=>void }
function External({href,children}:{href:string;children:React.ReactNode}){return <a className="source-link" href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={13} aria-hidden="true"/></a>}
function safeLink(input:string){try{const u=new URL(input);return ['http:','https:'].includes(u.protocol)?u.href:undefined}catch{return undefined}}
export default function Guide({packing,setPacking,shopping,setShopping,cloudTrip,setCloudTrip,details,setDetails}:Props){
 const orderLink=safeLink(details.orderLink)
 return <div className="guide-page page-enter"><PageHeading title="旅行手冊" eyebrow="GUIDE"><span className="reading-note">清單與隨身參考</span></PageHeading><div className="guide-layout"><SectionIndex/><div className="guide-sections">
 <PackingList items={packing} onChange={setPacking}/>
 <ShoppingLists lists={shopping} onChange={setShopping} cloudTrip={cloudTrip} onCloudTrip={setCloudTrip}/>
 <CouponShelf/>
 <div id="guide-reminders"><TaxRefundGuide/>
    <section aria-labelledby="reminders-title"><div className="section-heading"><h3 id="reminders-title">出發前的日本小筆記</h3></div><div className="guide-info-grid">{guideInformation.map(item => <details className="panel info-card" key={item.title}><summary>{item.title}<ChevronDown size={16} /></summary><p>{item.text}</p><External href={item.url}>{item.label}</External><p className="source-date">官方連結供出發前查核，規範更新待確認。</p></details>)}</div></section>

</div>
    <section className="panel emergency-panel" aria-labelledby="emergency-title"><p className="eyebrow">KEEP THIS CLOSE</p><h3 id="emergency-title">需要幫忙時</h3><div className="emergency-numbers"><a href="tel:110"><Phone size={19} /><span>警察<strong>110</strong></span></a><a href="tel:119"><Phone size={19} /><span>消防・救護車<strong>119</strong></span></a></div><p className="muted small">緊急時先說明所在地點。以下機構的電話及地址尚未查核，因此不預填號碼。</p><div className="emergency-links"><div><strong>台灣駐日本代表處</strong><p className="muted small">聯絡電話、急難救助專線：待確認</p><External href="https://www.roc-taiwan.org/jp/index.html">代表處官方聯絡資訊</External></div><div><strong>仙台當地緊急醫療</strong><p className="muted small">急診機構、夜間服務與外語支援：待確認</p><External href="https://www.city.sendai.jp/">仙台市官方網站</External></div><div><strong>{details.hotel}</strong><p className="muted small">{details.hotelAddress || '飯店地址：待確認，請比對訂房確認信'}</p>{details.hotelPhone && /^\+?[\d ()-]{5,40}$/.test(details.hotelPhone) ? <p><a className="source-link" href={`tel:${details.hotelPhone.replace(/[^+\d]/g, '')}`}><Phone size={14}/>{details.hotelPhone}（自行填寫）</a></p> : <p className="muted small">飯店電話：待確認</p>}<External href="https://www.hotelkeihan.co.jp/sendai/">ホテル京阪 仙台官方網站</External></div></div></section>

    <section className="panel" aria-labelledby="travel-title">
      <div className="section-heading"><h3 id="travel-title"><Plane size={19} />旅行資料總匯</h3><span className="chip">自動儲存</span></div>
      <p className="muted small">航班時間由旅行計畫提供，請以航空公司與訂單為準；皆為當地時間。</p>
      <div className="travel-fields">{([{ key: 'outbound', label: '去程航班' }, { key: 'inbound', label: '回程航班' }, { key: 'hotel', label: '住宿名稱' }] as const).map(({ key, label }) => <label className="field" key={key}>{label}<input value={details[key]} maxLength={500} onChange={e => setDetails({ ...details, [key]: e.target.value })} /></label>)}
        <label className="field">訂單連結（選填）<input type="url" placeholder="https://" value={details.orderLink} maxLength={2000} onChange={e => setDetails({ ...details, orderLink: e.target.value })} /></label>
        {details.orderLink && (orderLink ? <External href={orderLink}>開啟我的訂單</External> : <p className="field-error">請填寫有效的 http 或 https 網址。</p>)}
        <label className="field">旅行備註<textarea rows={3} placeholder="集合地點、入住提醒……請勿填寫敏感個資" maxLength={10000} value={details.notes} onChange={e => setDetails({ ...details, notes: e.target.value })} /></label>
        <label className="field">飯店地址（自行確認後填入）<input maxLength={500} value={details.hotelAddress ?? ''} placeholder="待確認，請比對飯店官網與訂房確認信" onChange={e => setDetails({ ...details, hotelAddress: e.target.value })}/></label>
        <label className="field">飯店電話（自行確認後填入）<input type="tel" maxLength={40} value={details.hotelPhone ?? ''} placeholder="待確認，例如 +81…" onChange={e => setDetails({ ...details, hotelPhone: e.target.value })}/></label>
        {details.hotelPhone && /^\+?[\d ()-]{5,40}$/.test(details.hotelPhone) && <a className="source-link" href={`tel:${details.hotelPhone.replace(/[^+\d]/g, '')}`}><Phone size={14}/>撥打自行填寫的飯店電話</a>}
      </div>
    </section>

</div></div></div>
}
