import { useState } from 'react'
import { Backpack, Check, ChevronDown, ExternalLink, Minus, Pencil, Phone, Plane, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { PackingItem, TravelDetails } from '../types'
import { defaultPacking, packingGroups, guideInformation, practicalInformation } from '../data/guide'
import CouponShelf from './guide/CouponShelf'
import TaxRefundGuide from './guide/TaxRefundGuide'
import SectionIndex from './guide/SectionIndex'
import PageHeading from './ui/PageHeading'

interface Props {
  group: string
  setGroup: (group: string) => void
  packing: PackingItem[]
  setPacking: (items: PackingItem[]) => void
  details: TravelDetails
  setDetails: (details: TravelDetails) => void
}

function External({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="source-link" href={href} target="_blank" rel="noreferrer">{children} <ExternalLink size={13} aria-hidden="true" /></a>
}

function safeLink(input: string) {
  try {
    const url = new URL(input)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

export default function Guide({ packing, setPacking, details, setDetails, group, setGroup }: Props) {
  const [editing, setEditing] = useState<PackingItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const items = packing.filter(item => item.group === group)
  const done = items.filter(item => item.done).length
  const update = (id: string, change: Partial<PackingItem>) => setPacking(packing.map(item => item.id === id ? { ...item, ...change } : item))
  const begin = (item?: PackingItem) => {
    setEditing(item ?? null); setAdding(true); setName(item?.name ?? ''); setQuantity(item?.quantity ?? 1)
  }
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) return
    if (editing) update(editing.id, { name: name.trim(), quantity })
    else setPacking([...packing, { id: crypto.randomUUID(), group, name: name.trim(), quantity, done: false }])
    setAdding(false); setEditing(null)
  }
  const orderLink = safeLink(details.orderLink)

  return <div className="guide-page page-enter">
    <PageHeading title="旅行手冊" eyebrow="GUIDE"><span className="reading-note">清單與隨身參考</span></PageHeading>
    <div className="guide-layout"><SectionIndex/><div className="guide-sections">

    <section className="panel packing-panel" aria-labelledby="packing-title">
      <div className="section-heading"><h3 id="packing-title"><Backpack size={19} /> 行李與購物清單</h3><button className="icon-button" aria-label="還原預設清單" onClick={() => setResetting(true)}><RotateCcw size={17} /></button></div>
      <div className="packing-tabs" role="group" aria-label="清單分類">{packingGroups.map(value => {
        const list = packing.filter(item => item.group === value)
        return <button key={value} className={`chip ${group === value ? 'active' : ''}`} aria-pressed={group === value} onClick={() => { setGroup(value); setAdding(false) }}>{value}<span>{list.filter(item => item.done).length}/{list.length}</span></button>
      })}</div>
      <div className="packing-progress"><span>{group}</span><span>{done} / {items.length} 已準備</span></div>
      <progress max={Math.max(items.length, 1)} value={done} aria-label={`${group}完成比例`} />
      <ul className="packing-list">{items.map(item => <li key={item.id} className={item.done ? 'is-complete' : ''}>
        <label className="packing-check"><input type="checkbox" checked={item.done} onChange={() => update(item.id, { done: !item.done })} /><span>{item.name}</span></label>
        <div className="packing-actions"><button className="icon-button" aria-label={`減少 ${item.name} 數量`} disabled={item.quantity <= 1} onClick={() => update(item.id, { quantity: item.quantity - 1 })}><Minus size={14} /></button><span className="quantity" aria-label={`數量 ${item.quantity}`}>{item.quantity}</span><button className="icon-button" aria-label={`增加 ${item.name} 數量`} disabled={item.quantity >= 999} onClick={() => update(item.id, { quantity: item.quantity + 1 })}><Plus size={14} /></button><button className="icon-button" aria-label={`編輯 ${item.name}`} onClick={() => begin(item)}><Pencil size={15} /></button><button className="icon-button danger" aria-label={`刪除 ${item.name}`} onClick={() => setDeleting(item.id)}><Trash2 size={15} /></button></div>
      </li>)}</ul>
      {!items.length && <p className="empty-state">這一頁還留白著。加入第一件想帶走的物品吧。</p>}
      {adding ? <form className="packing-form" onSubmit={save}><label className="field">物品名稱<input autoFocus required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="例如：保暖針織外套" /></label><label className="field">數量<input type="number" required min={1} max={999} step={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label><div className="button-row"><button type="submit" className="button primary"><Check size={15} />儲存物品</button><button type="button" className="button" onClick={() => setAdding(false)}>取消</button></div></form> : <button className="button add-item" onClick={() => begin()}><Plus size={16} />新增物品</button>}
      {resetting && <div className="confirmation" role="alert"><p>還原會取代所有自訂清單與勾選狀態。建議先匯出備份。</p><div className="button-row"><button className="button danger" onClick={() => { setPacking(defaultPacking.map(item => ({ ...item }))); setResetting(false); setAdding(false) }}>確定還原預設清單</button><button className="button" onClick={() => setResetting(false)}>取消</button></div></div>}
      {deleting && <div className="confirmation" role="alert"><p>確定刪除「{packing.find(item => item.id === deleting)?.name}」？</p><div className="button-row"><button className="button danger" onClick={() => { setPacking(packing.filter(item => item.id !== deleting)); setDeleting(null) }}>確定刪除物品</button><button className="button" onClick={() => setDeleting(null)}>取消</button></div></div>}
    </section>

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

    <CouponShelf/>
    <TaxRefundGuide/>

    <section aria-labelledby="reminders-title"><div className="section-heading"><h3 id="reminders-title">出發前的日本小筆記</h3></div><div className="guide-info-grid">{guideInformation.map(item => <details className="panel info-card" key={item.title}><summary>{item.title}<ChevronDown size={16} /></summary><p>{item.text}</p><External href={item.url}>{item.label}</External><p className="source-date">官方連結供出發前查核，規範更新待確認。</p></details>)}</div></section>

    <section className="panel emergency-panel" aria-labelledby="emergency-title"><p className="eyebrow">KEEP THIS CLOSE</p><h3 id="emergency-title">需要幫忙時</h3><div className="emergency-numbers"><a href="tel:110"><Phone size={19} /><span>警察<strong>110</strong></span></a><a href="tel:119"><Phone size={19} /><span>消防・救護車<strong>119</strong></span></a></div><p className="muted small">緊急時先說明所在地點。以下機構的電話及地址尚未查核，因此不預填號碼。</p><div className="emergency-links"><div><strong>台灣駐日本代表處</strong><p className="muted small">聯絡電話、急難救助專線：待確認</p><External href="https://www.roc-taiwan.org/jp/index.html">代表處官方聯絡資訊</External></div><div><strong>仙台當地緊急醫療</strong><p className="muted small">急診機構、夜間服務與外語支援：待確認</p><External href="https://www.city.sendai.jp/">仙台市官方網站</External></div><div><strong>{details.hotel}</strong><p className="muted small">{details.hotelAddress || '飯店地址：待確認，請比對訂房確認信'}</p>{details.hotelPhone && /^\+?[\d ()-]{5,40}$/.test(details.hotelPhone) ? <p><a className="source-link" href={`tel:${details.hotelPhone.replace(/[^+\d]/g, '')}`}><Phone size={14}/>{details.hotelPhone}（自行填寫）</a></p> : <p className="muted small">飯店電話：待確認</p>}<External href="https://www.hotelkeihan.co.jp/sendai/">ホテル京阪 仙台官方網站</External></div></div></section>

    <section aria-labelledby="practical-title"><div className="section-heading"><div><p className="eyebrow">A LITTLE LOCAL KNOWLEDGE</p><h3 id="practical-title">仙台實用資訊</h3></div></div><div className="guide-info-grid">{practicalInformation.map(item => <details className="panel info-card" key={item.title}><summary>{item.title}<ChevronDown size={16} /></summary><p>{item.text}</p><External href={item.url}>{item.label}</External><p className="source-date">資料整理：2026/11/05｜2026 最新資訊待確認</p></details>)}</div><div className="panel practical-edit"><label className="field">我的實用資訊補充（可編輯）<textarea rows={5} value={details.practicalNotes ?? ''} maxLength={20000} onChange={e => setDetails({ ...details, practicalNotes: e.target.value })} placeholder="活動日期、退稅流程、分店資訊、楓況、醫療聯絡方式……請記下官方來源與查核日期。未確認內容請保留「待確認」標記。"/></label><p className="source-date">自行整理的資料也會隨完整備份一起保存。請出發前再次核實。</p></div></section>
    </div></div>
  </div>
}
