import { useState } from 'react'
import { Camera, ChevronDown } from 'lucide-react'
import { imageUrl, tax } from '../../lib/guide/content'
import MediaDialog from './MediaDialog'

type ImageEntry = typeof tax.sections[number]['image']
function TeachingImage({ image, number, onOpen }: { image: ImageEntry; number: number; onOpen: () => void }) {
  const [failed, setFailed] = useState(false)
  if (!image.available || failed) return <div className="tax-image-pending" role="status"><Camera size={20}/><p>{failed ? '教學圖片暫時無法載入' : `教學圖 ${number} 原圖待加入`}</p><small>{failed ? '可以先閱讀下方文字整理。' : '文字整理可先閱讀；補上原圖後即可點擊放大。'}</small></div>
  return <button className="tax-image-button" onClick={onOpen}><img loading="lazy" src={imageUrl(image.path)} alt={image.alt} onError={() => setFailed(true)}/><span><Camera size={14}/>點擊放大原圖</span></button>
}
function jump(id:string){const target=document.getElementById(id);if(target instanceof HTMLDetailsElement)target.open=true;target?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
export default function TaxRefundGuide() {
  const [image,setImage]=useState<{title:string;image:ImageEntry}|null>(null),[search,setSearch]=useState('')
  const merchantMatches=tax.merchants.filter(m=>`${m.name} ${m.platform}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <section id="guide-tax-refund" className="guide-extension tax-guide" aria-labelledby="tax-guide-title"><div className="section-heading"><div><p className="eyebrow">NOVEMBER 2026 · TAX REFUND NOTEBOOK</p><h3 id="tax-guide-title">日本免稅與新退稅手冊</h3></div></div>
    <p className="guide-copy">{tax.overview}</p><p className="source-date">資料整理日期：{tax.compiledAt.replaceAll('-','/')}｜{tax.source}｜{tax.verificationStatus}</p>
    <aside className="sendai-tax-note"><strong>這趟從仙台機場出境，請特別留意</strong><p>{tax.sendaiNotice}</p></aside>
    <nav className="tax-section-nav" aria-label="免稅教學章節">{tax.sections.map((s,i)=><button key={s.id} onClick={()=>jump(`tax-${s.id}`)}><span>0{i+1}</span>{s.shortTitle}</button>)}<button onClick={()=>jump('tax-merchants')}><span>05</span>商家費用</button></nav>
    {tax.sections.map((s,i)=><details className="tax-chapter" id={`tax-${s.id}`} key={s.id} open={i===0?true:undefined}><summary><span className="chapter-number">0{i+1}</span><span><h4>{s.title}</h4><p>{s.summary}</p></span><ChevronDown size={18}/></summary><div className="tax-chapter-content">
      <TeachingImage image={s.image} number={i+1} onOpen={()=>setImage({title:s.title,image:s.image})}/>
      {s.id==='platforms'&&<><h5>先準備好</h5><ul className="guide-bullets">{tax.preparation.map(v=><li key={v}>{v}</li>)}</ul><p className="guide-copy">{tax.platformReminder}</p><div className="platform-list">{tax.platforms.map(p=><article key={p.name}><div><h5>{p.name}</h5><span>{p.format}</span></div><strong>{p.fee}</strong><ul>{p.notes.map(n=><li key={n}>{n}</li>)}</ul></article>)}</div><h5>退稅方式</h5><dl className="refund-methods">{tax.refundMethods.map(m=><div key={m.title}><dt>{m.title}</dt><dd>{m.text}</dd></div>)}</dl><p className="tax-callout">{tax.refundReminder} <span>（使用者提供，待官方核對）</span></p></>}
      {s.id==='prepare'&&<><p className="guide-copy">{tax.downloadOptions.map(o=>`${o.format}：${o.names.join('、')}。`).join('')}</p><ol className="home-screen-steps">{tax.homeScreenSteps.map((v,index)=><li key={v}><span>{index+1}</span><p>{v}</p></li>)}</ol></>}
      {s.id==='airport'&&<><p className="guide-copy">{tax.comparisonIntro}</p><div className="tax-table-scroll" tabIndex={0} role="region" aria-label="VJW 與機台比較，可左右捲動"><table><caption>使用者提供的 VJW 與機場手續機台比較（待官方核對）</caption><thead><tr><th scope="col">項目</th><th scope="col">VJW</th><th scope="col">機場手續機台（KIOSK）</th></tr></thead><tbody>{tax.comparison.map(row=><tr key={row.topic}><th scope="row">{row.topic}</th><td>{row.vjw}</td><td>{row.kiosk}</td></tr>)}</tbody></table></div><dl className="wifi-note"><dt>提供的公共 Wi-Fi 名稱</dt><dd><code>{tax.wifi.name}</code></dd><dt>提供的密碼</dt><dd><code>{tax.wifi.password}</code></dd></dl><p className="muted small">{tax.wifi.note}</p></>}
      {s.id==='cash'&&<><p className="tax-callout">{tax.cashReminder}</p><div className="cash-list">{tax.cashProviders.map(p=><article key={p.name}><h5>{p.name}</h5><p className="muted small">{p.type}</p><dl><dt>提供的機場清單</dt><dd>{p.airports.join('、')}</dd><dt>提供的平台清單</dt><dd>{p.platforms.join('、')}</dd></dl></article>)}</div></>}
      <details className="raw-source"><summary>查看使用者提供的原文</summary><p>{s.rawText}</p></details>
    </div></details>)}
    <section className="merchant-guide" id="tax-merchants" aria-labelledby="merchant-title"><div className="section-heading"><div><p className="eyebrow">KNOW THE FEE BASIS</p><h4 id="merchant-title">熱門商家退稅手續費</h4></div><span className="muted small">{tax.merchants.length} 筆提供資料</span></div><p className="guide-copy">未稅價、含稅價、消費稅額、平台費及領現費的基礎不同；這裡保留原文，不自動加總為「實際總費用」。</p><label className="field merchant-search">搜尋商家或平台<input type="search" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)} placeholder="例如：UNIQLO、Global Blue"/></label>{!merchantMatches.length&&<p className="guide-empty" role="status">沒有符合的商家或平台。</p>}{tax.merchantGroups.map(group=>{const items=merchantMatches.filter(m=>m.group===group.id);return items.length>0&&<div className="merchant-group" key={group.id}><h5>{group.title}</h5><p className="tax-callout small">{group.note}</p>{items.map(m=><details className="merchant-row" key={m.name}><summary><strong>{m.name}</strong><span>{m.fee}</span><ChevronDown size={15}/></summary><dl><dt>退稅平台</dt><dd>{m.platform}</dd><dt>計費基礎</dt><dd>{m.basis}</dd>{m.notes&&<><dt>備註</dt><dd>{m.notes}</dd></>}<dt>查核狀態</dt><dd>使用者提供，待官方核對</dd></dl></details>)}</div>})}</section>
    <aside className="tax-verification"><strong>{tax.disclaimer}</strong><p>出發前請再核對官方來源，特別是手續費與 VJW 支援機場。以下為官方查核入口，未宣稱已讀取或核實頁面最新內容。</p><ul>{tax.sources.map(s=><li key={s.url}><a className="source-link" href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ul></aside>
    <details className="raw-source legacy-tax-note"><summary>{tax.legacyPreparation.title}</summary><p>{tax.legacyPreparation.intro}</p><ol>{tax.legacyPreparation.steps.map(s=><li key={s.title}><strong>{s.title}</strong><p>{s.text}</p></li>)}</ol><p>{tax.legacyPreparation.note}</p></details>
    {image&&<MediaDialog title={image.title} src={imageUrl(image.image.path)} alt={image.image.alt} onClose={()=>setImage(null)}><p className="muted small">使用者提供的整理圖；費率與適用機場待官方核對。</p></MediaDialog>}
  </section>
}
