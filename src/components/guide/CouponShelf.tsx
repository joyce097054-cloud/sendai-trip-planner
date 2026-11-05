import { useEffect, useState } from 'react'
import { FileImage, ChevronRight } from 'lucide-react'
import { couponState, coupons, imageUrl } from '../../lib/guide/content'
import type { Coupon } from '../../lib/guide/content'
import MediaDialog from './MediaDialog'

function Thumbnail({coupon}:{coupon:Coupon}) {
  const [failed,setFailed]=useState(false)
  return coupon.imagePath&&!failed ? <img loading="lazy" src={imageUrl(coupon.imagePath)} alt={`${coupon.shopName} 優惠券縮圖`} onError={()=>setFailed(true)}/> : <span className="coupon-no-image"><FileImage size={25}/><span>{failed?'圖片暫缺':coupon.isExample?'範例，無券圖':'待提供券圖'}</span></span>
}
export default function CouponShelf() {
  const [category,setCategory]=useState('全部'),[selected,setSelected]=useState<Coupon|null>(null),[now,setNow]=useState(()=>new Date())
  useEffect(()=>{const tick=()=>setNow(new Date());const timer=setInterval(tick,60000);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick)}},[])
  if(!coupons)return <section id="guide-coupons" className="guide-extension"><h3>優惠券</h3><p className="ledger-error" role="alert">優惠券資料格式不正確，請檢查 coupons.json。其他指南功能仍可使用。</p></section>
  const items=coupons.items.filter(c=>category==='全部'||c.category===category)
  return <section id="guide-coupons" className="guide-extension" aria-labelledby="coupons-title"><div className="section-heading"><div><p className="eyebrow">SHOPPING COMPANION</p><h3 id="coupons-title">隨手帶著的優惠券</h3></div><span className="muted small">{coupons.items.filter(c=>!c.isExample).length} 張真實券資料</span></div><p className="guide-copy">點選後在 App 內查看券圖與條件，不跳外站。優惠內容及適用分店請以券面與現場為準。</p>
    {!coupons.items.some(c=>!c.isExample)&&<p className="coupon-empty-note">目前尚未提供真實優惠券圖片。下方只示範欄位與操作，不可出示使用。</p>}
    <div className="coupon-filters" role="group" aria-label="優惠券分類">{['全部',...coupons.categories].map(c=><button key={c} className="chip" aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    {!items.length&&<div className="guide-empty" role="status"><FileImage size={25}/><p>這個分類還沒有優惠券。</p><span>收到你提供的券圖後即可加入。</span></div>}
    <ul className="coupon-list">{items.map(c=>{const status=couponState(c,now);return <li key={c.id}><button className="coupon-entry" aria-label={`查看 ${c.shopName} 優惠券${c.isExample?'（範例）':''}`} onClick={()=>setSelected(c)}><div className="coupon-thumbnail"><Thumbnail coupon={c}/></div><div className="coupon-entry-copy"><span className={`coupon-status ${status.kind}`}>{status.label}</span><h4>{c.shopName}</h4><p>{c.offerSummary}</p><small>{c.category} · {c.validUntil?`至 ${c.validUntil}`:'期限待確認'}</small></div><ChevronRight size={16} aria-hidden="true"/></button></li>})}</ul>
    <p className="source-date">資料整理日期：{coupons.updatedAt.replaceAll('-','/')}｜券圖由使用者自行提供</p>
    {selected&&<MediaDialog title={`${selected.shopName} 優惠券${selected.isExample?'・範例':''}`} src={selected.imagePath?imageUrl(selected.imagePath):null} alt={`${selected.shopName} 優惠券完整圖片`} onClose={()=>setSelected(null)}><p className={`coupon-status ${couponState(selected,now).kind}`}>{couponState(selected,now).label}</p>{(selected.isExample||couponState(selected,now).kind==='expired')&&<p className="coupon-warning">{selected.isExample?'這是範例資料，不是真實優惠券。':'這張優惠券已過期，僅供查看。'}</p>}<h4>{selected.offerSummary}</h4><dl className="coupon-facts"><dt>有效期間（日本日期）</dt><dd>{selected.validFrom??'開始日期待確認'} ～ {selected.validUntil??'結束日期待確認'}</dd><dt>使用說明</dt><dd><ul>{selected.instructions.map((v,i)=><li key={i}>{v}</li>)}</ul></dd><dt>適用條件</dt><dd><ul>{selected.conditions.map((v,i)=><li key={i}>{v}</li>)}</ul></dd><dt>來源備註</dt><dd>{selected.sourceNotes}</dd></dl></MediaDialog>}
  </section>
}
