import { useState } from 'react'
import { Download, Plus, RefreshCw, Share2, Trash2, Pencil, Wallet } from 'lucide-react'
import Modal from '../../components/Modal'
import PageHeading from '../../components/ui/PageHeading'
import { ExpenseForm, NamesForm, RateForm, SettlementForm } from './Forms'
import { inviteLink, ledgerConfig, newInviteToken, privateTokenForTrip, rememberPrivateLink } from './client'
import { estimateTwd, summarize, yenLabel } from './domain'
import { downloadLedgerCsv } from './csv'
import { useLedger } from './useLedger'
import { expenseCategories } from './types'
import type { Expense, LedgerTrip, Member, Settlement } from './types'

function tokenFromInput(input: string) {
  const text=input.trim()
  if(/^[a-fA-F0-9]{64}$/.test(text))return text.toLowerCase()
  try {
    const url=new URL(text)
    if(!['https:','http:'].includes(url.protocol))return ''
    const params=new URLSearchParams(url.hash.split('?')[1]??'')
    const token=params.get('book')??url.searchParams.get('book')??url.searchParams.get('join')??''
    return /^[a-fA-F0-9]{64}$/.test(token)?token.toLowerCase():''
  }catch{return ''}
}

export default function Expenses() {
  const ledger=useLedger()
  const {data,session,busy,loading,online,error,setError,mutate}=ledger
  const [editingExpense,setEditingExpense]=useState<{value:Expense|null}|null>(null)
  const [editingSettlement,setEditingSettlement]=useState<{value:Settlement|null}|null>(null)
  const [editingRate,setEditingRate]=useState<LedgerTrip|null>(null)
  const [editingNames,setEditingNames]=useState<{trip:LedgerTrip;members:Member[]}|null>(null)
  const [deleting,setDeleting]=useState<{kind:'expense'|'settlement';id:string;title:string;version:number}|null>(null)
  const [join,setJoin]=useState('')
  const [tripTitle,setTripTitle]=useState('仙台五日賞楓自由行')
  const [newNames,setNewNames]=useState(['',''])
  const [createToken]=useState(newInviteToken)
  const [sharing,setSharing]=useState<{trip:string;token:string}|null>(null)
  const [rotating,setRotating]=useState<{trip:string;version:number;token:string}|null>(null)
  const [message,setMessage]=useState('')
  const [payerFilter,setPayerFilter]=useState(''),[categoryFilter,setCategoryFilter]=useState(''),[order,setOrder]=useState('desc')
  const trip=data?.trip
  const members=data?.members??[]
  const knownToken=trip?privateTokenForTrip(trip.id):''
  const share=trip&&knownToken?{trip:trip.id,token:knownToken}:sharing?.trip===trip?.id?sharing:null
  const name=(id:string)=>members.find(m=>m.id===id)?.name??'尚未取得旅伴名稱'
  let summary:ReturnType<typeof summarize>|null=null, calculationError=''
  try {if(data)summary=summarize(members,data.expenses,data.settlements)}catch(e){calculationError=(e as Error).message}
  const twd=(amount:number)=>{if(!trip?.rate)return '尚未設定匯率';try{return `約 NT$${estimateTwd(amount,trip.rate).toLocaleString('zh-TW')}`}catch{return '匯率無法換算，請檢查設定'}}
  async function act(work:()=>Promise<unknown>,success:string){setError('');setMessage('');try{await work();setMessage(success)}catch(e){setError((e as Error).message)}}
  async function createBook(){
    const names=newNames.map(n=>n.trim())
    if(!tripTitle.trim()||names.some(n=>!n)){setError('請填寫旅程名稱與兩位旅伴的名稱。');return}
    await act(async()=>{
      const result=await mutate('create_book',{title:tripTitle.trim(),names,token:createToken},null,null)
      rememberPrivateLink(createToken,String(result.trip_id))
      setSharing({trip:String(result.trip_id),token:createToken})
    },'私人帳本已建立，請保留私人連結並分享給旅伴。')
  }
  async function openBook(){
    const token=tokenFromInput(join)
    if(!token){setError('請貼上完整私人旅程連結或 64 字元私人碼。');return}
    await act(async()=>{
      rememberPrivateLink(token)
      history.replaceState(null,'',inviteLink(token))
      await ledger.retryAccess()
      setJoin('')
    },'私人帳本已開啟，現在會從雲端同步。')
  }
  async function rotateLink(){
    if(!rotating)return
    await act(async()=>{
      await mutate('rotate_link',{token:rotating.token},rotating.version,rotating.trip)
      rememberPrivateLink(rotating.token,rotating.trip);setSharing({trip:rotating.trip,token:rotating.token});setRotating(null)
    },'私人連結已更新。請將新連結重新分享給旅伴與其他使用中的裝置。')
  }
  async function copyLink(){
    if(!share)return
    if(!navigator.clipboard){setMessage('請點選下方私人連結欄位，全選後複製。');return}
    await act(()=>navigator.clipboard.writeText(inviteLink(share.token)),'私人連結已複製，請只傳給你的旅伴。')
  }
  const notices=<>{!online&&<div className="ledger-error" role="alert"><strong>目前離線，所有帳務送出已停用。</strong><p>連線恢復後會重新讀取最新帳務，請確認後再送出。</p></div>}{error&&<div className="ledger-error" role="alert">{error}<button className="text-button" disabled={busy||loading||!online} onClick={()=>void act(()=>ledger.retryAccess(),'已重新取得帳本存取狀態。')}>重新開啟私人帳本</button></div>}{message&&<p className="ledger-message" role="status">{message}</p>}</>
  if(!ledgerConfig.ready||location.protocol==='file:')return <div className="ledger-page"><PageHeading title="兩個人，一份旅行帳本" eyebrow="TRAVEL LEDGER"/><section className="panel"><Wallet size={27}/><h3>雲端分帳尚未啟用</h3><p>設定完成後，用同一個私人旅程連結即可共用帳本，不需要帳號或驗證信。</p><p className="muted">既有行程、清單與照片仍可照常使用，不會因分帳尚未連接而清除。</p><details><summary>設定者指引</summary><p className="small muted">{location.protocol==='file:'?'免安裝 HTML 不提供雲端帳本，請改用正式 HTTPS 網站。':ledgerConfig.error||'請設定 Supabase 公開連線資訊、啟用匿名驗證，並套用私人帳本 migration；不要使用私人 Secret key。'}</p></details></section></div>
  if(ledger.authLoading)return <div className="ledger-page"><PageHeading title="共用旅行帳"/>{notices}<p role="status">正在安全地開啟私人帳本…</p></div>
  if(!session||!data)return <div className="ledger-page"><PageHeading title="兩個人，一份旅行帳本" eyebrow="PRIVATE TRAVEL LEDGER"/>{notices}<p role="status">{loading?'正在開啟私人帳本…':'尚未取得私人帳本資料。'}</p><button className="button" disabled={busy||loading||!online} onClick={()=>void act(()=>ledger.retryAccess(),'已重新取得帳本存取狀態。')}>重新開啟私人帳本</button><p className="muted small">若私人連結已更新，請使用旅伴提供的新連結開啟，也可直接貼在下方。</p><form className="form-stack" onSubmit={e=>{e.preventDefault();void openBook()}}><label className="field">已有私人旅程連結<input value={join} onChange={e=>setJoin(e.target.value)} required maxLength={2000} placeholder="貼上私人連結或私人碼" autoCapitalize="none" autoCorrect="off"/></label><button className="button" disabled={busy||!online}>開啟私人帳本</button></form></div>
  const visible=data.expenses.filter(e=>(!payerFilter||e.payer_id===payerFilter)&&(!categoryFilter||e.category===categoryFilter)).sort((a,b)=>(order==='asc'?1:-1)*(a.date.localeCompare(b.date)||a.id.localeCompare(b.id)))
  return <div className="ledger-page"><PageHeading title={trip?.title ?? '開始一本旅行帳'} eyebrow="SHARED EXPENSES"><div className="ledger-header-actions">{trip && <button className="button primary" disabled={busy || !online || members.length !== 2 || !!calculationError} onClick={() => setEditingExpense({ value: null })}><Plus size={17} aria-hidden="true"/>新增消費</button>}<button className="icon-button" aria-label="重新同步帳務" disabled={loading || !online} onClick={() => void ledger.refresh()}><RefreshCw size={19} aria-hidden="true"/></button></div></PageHeading>
    <div className="ledger-sync" data-connection={online ? ledger.connection : 'offline'} aria-live="polite"><span>{!online?'離線':ledger.connection==='live'?'即時連線已建立':ledger.connection==='connecting'?'正在建立即時連線':'即時連線中斷，將重新連接'}</span>{ledger.updated&&<span>最近讀取 {new Date(ledger.updated).toLocaleTimeString('zh-TW',{hour12:false})}</span>}</div>
    {notices}
    {!trip?<section className="panel ledger-trip-tools"><h3>建立私人帳本</h3><p className="muted small">只需設定兩位旅伴的名稱，再把同一個私人連結分享給對方。更換手機後也可用這個連結重新開啟。</p><form className="form-stack" onSubmit={e=>{e.preventDefault();void createBook()}}><label className="field">旅程名稱<input required maxLength={100} value={tripTitle} onChange={e=>setTripTitle(e.target.value)}/></label>{newNames.map((value,index)=><label className="field" key={index}>旅伴 {index+1} 名稱<input required maxLength={40} value={value} onChange={e=>setNewNames(newNames.map((name,i)=>i===index?e.target.value:name))}/></label>)}<button className="button primary" disabled={busy||!online||!tripTitle.trim()||newNames.some(n=>!n.trim())}>{busy?'建立中…':'建立私人帳本'}</button></form><form className="form-stack" onSubmit={e=>{e.preventDefault();void openBook()}}><label className="field">已有私人旅程連結<input value={join} onChange={e=>setJoin(e.target.value)} required maxLength={2000} placeholder="貼上私人連結或私人碼" autoCapitalize="none" autoCorrect="off"/></label><button className="button" disabled={busy||!online}>開啟私人帳本</button></form></section>:<>
      <div className="ledger-members">{members.map(m=><span key={m.id}>{m.name}</span>)}<button className="text-button" disabled={busy||!online} onClick={()=>setEditingNames({trip:{...trip},members:members.map(m=>({...m}))})}>修改兩人名稱</button></div>

      {calculationError&&<p className="ledger-error" role="alert">{calculationError}</p>}
      {summary&&<section className="ledger-summary" aria-label="分帳結算"><p className="eyebrow">HOW WE SHARE THE JOURNEY</p><p className="muted small">累計消費 <strong>{yenLabel(summary.total)}</strong> · {twd(summary.total)}</p><h3>{summary.transfer?<>{summary.transfer.from.name} 需要付給 {summary.transfer.to.name}<strong>{yenLabel(summary.transfer.amount)}</strong></>:'目前無需結算'}</h3>{summary.transfer&&<p className="muted">{twd(summary.transfer.amount)}</p>}<p className="ledger-rate">目前匯率：{trip.rate?`1 JPY = ${trip.rate} TWD`:'尚未設定'}<button className="text-button" disabled={busy||!online} onClick={()=>setEditingRate({...trip})}>設定／修改</button></p><div className="ledger-balances" aria-label="兩人的付款與負擔">{summary.balances.map(b => <div key={b.member.id}><h4>{b.member.name}</h4><dl><dt>實際付款</dt><dd>{yenLabel(b.paid)}</dd><dt>應負擔</dt><dd>{yenLabel(b.owed)}</dd></dl></div>)}</div><details className="ledger-balance-details"><summary>查看結算與淨餘額</summary>{summary.balances.map(b => <p key={b.member.id}>{b.member.name}：已付結算 {yenLabel(b.sent)} · 已收 {yenLabel(b.received)} · 目前淨餘額 {yenLabel(b.net)}</p>)}</details></section>}
      <div className="ledger-toolbar"><button className="button" disabled={busy||!online||members.length!==2||!!calculationError} onClick={()=>setEditingSettlement({value:null})}>記錄已結算</button><button className="button" disabled={!data.expenses.length&&!data.settlements.length} onClick={()=>downloadLedgerCsv(data)}><Download size={15}/>匯出 CSV</button></div>
      <section className="ledger-records"><div className="section-heading"><h3>消費紀錄</h3><span className="muted small">{visible.length} 筆</span></div><div className="ledger-filters"><label className="field">付款人篩選<select value={payerFilter} onChange={e=>setPayerFilter(e.target.value)}><option value="">全部旅伴</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="field">分類篩選<select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">全部分類</option>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select></label><label className="field">日期排序<select value={order} onChange={e=>setOrder(e.target.value)}><option value="desc">新到舊</option><option value="asc">舊到新</option></select></label></div>{!visible.length&&<p className="empty-state">{data.expenses.length?'這個篩選下沒有消費紀錄。':'還沒有消費紀錄。從第一筆真實支出開始。'}</p>}<ul className="ledger-list">{visible.map(e=><li key={e.id}><div className="ledger-record-heading"><div><time>{e.date}</time><h4>{e.title}</h4></div><strong>{yenLabel(e.amount_jpy)}</strong></div><p className="muted small">{name(e.payer_id)} 付款 · {e.category} · {e.split_mode==='equal'?'平均分攤':e.split_mode==='single'?`由 ${name(Object.keys(e.shares).find(id=>e.shares[id]===e.amount_jpy)??'')} 全額負擔`:'自訂分攤'}</p><p className="ledger-shares">{members.map(m=>`${m.name} ${yenLabel(e.shares[m.id])}`).join(' ／ ')}</p>{e.notes&&<p className="ledger-notes">{e.notes}</p>}<div className="ledger-row-actions"><button className="text-button" disabled={busy||!online} aria-label={`編輯消費 ${e.title}`} onClick={()=>setEditingExpense({value:{...e,shares:{...e.shares}}})}><Pencil size={13}/>編輯</button><button className="text-button danger" disabled={busy||!online} aria-label={`刪除消費 ${e.title}`} onClick={()=>setDeleting({kind:'expense',id:e.id,title:e.title,version:e.version})}><Trash2 size={13}/>刪除</button></div></li>)}</ul></section>
      <section className="ledger-records"><h3>實際結算紀錄</h3><p className="muted small">保留每次實際轉帳，部分結算會反映在上方的應付金額。這些轉帳不會增加消費總額。</p>{!data.settlements.length&&<p className="empty-state">尚無結算紀錄。</p>}<ul className="ledger-list">{[...data.settlements].sort((a,b)=>b.date.localeCompare(a.date)).map(s=><li key={s.id}><div className="ledger-record-heading"><div><time>{s.date}</time><h4>{name(s.payer_id)} → {name(s.receiver_id)}</h4></div><strong>{yenLabel(s.amount_jpy)}</strong></div>{s.notes&&<p className="ledger-notes">{s.notes}</p>}<div className="ledger-row-actions"><button className="text-button" disabled={busy||!online} aria-label={`編輯結算 ${s.date}`} onClick={()=>setEditingSettlement({value:{...s}})}>編輯</button><button className="text-button danger" disabled={busy||!online} aria-label={`刪除結算 ${s.date}`} onClick={()=>setDeleting({kind:'settlement',id:s.id,title:`${s.date} ${name(s.payer_id)} 的結算`,version:s.version})}>刪除</button></div></li>)}</ul></section>      <details className="panel ledger-trip-tools"><summary>私人連結與帳本設定</summary><p className="muted small">持有私人連結的人可以讀寫帳本，請只分享給你的旅伴。連結不因換手機或清除瀏覽器資料而失效。</p>{data.trips.length>1&&<label className="field">目前帳本<select value={trip.id} onChange={e=>{setPayerFilter('');setCategoryFilter('');ledger.selectTrip(e.target.value)}}>{data.trips.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}{share?<><label className="field">私人旅程連結<input readOnly value={inviteLink(share.token)} onFocus={e=>e.target.select()}/></label><button className="button" onClick={()=>void copyLink()}><Share2 size={15}/>複製私人連結</button></>:<p className="muted small">目前裝置已有存取權，但沒有保留原私人連結。可向旅伴索取，或重新產生連結。</p>}<button className="text-button danger" disabled={busy||!online} onClick={()=>setRotating({trip:trip.id,version:trip.version,token:newInviteToken()})}>重新產生私人連結</button></details>
      <p className="small muted">帳務保存在雲端；既有「資料備份」JSON 保護本機行程及照片。共同帳務可另匯出 CSV，兩種備份用途不同。</p>
    </>}
    {editingExpense&&<ExpenseForm expense={editingExpense.value} members={members} busy={busy} online={online} onClose={()=>setEditingExpense(null)} onSave={async(value,version)=>{await mutate('save_expense',{...value},version);setEditingExpense(null);setMessage('消費已送交雲端。')}}/>}
    {editingRate&&<RateForm trip={editingRate} busy={busy} online={online} onClose={()=>setEditingRate(null)} onSave={async(rate,version)=>{await mutate('set_rate',{rate},version);setEditingRate(null);setMessage('共同匯率已儲存。')}}/>}
    {editingSettlement&&<SettlementForm entry={editingSettlement.value} members={members} defaultPayer={summary?.transfer?.from.id??''} defaultAmount={summary?.transfer?.amount??0} busy={busy} online={online} onClose={()=>setEditingSettlement(null)} onSave={async(value,version)=>{await mutate('save_settlement',{...value},version);setEditingSettlement(null);setMessage('實際結算已記錄。')}}/>}
    {editingNames&&<NamesForm trip={editingNames.trip} members={editingNames.members} busy={busy} online={online} onClose={()=>setEditingNames(null)} onSave={async(names,version)=>{await mutate('rename_participants',{names},version);setEditingNames(null);setMessage('兩位旅伴的名稱已更新。')}}/>}
    {rotating&&<Modal title="重新產生私人連結" onClose={()=>{if(!busy)setRotating(null)}}><div className="form-stack"><p>舊私人連結會失效，其他手機的存取權也會撤銷。請將新連結重新傳給旅伴；原有消費與結算紀錄會保留。</p><p className="muted small">只有目前這個裝置保留存取權。另一支手機或更換後的手機可用新連結重新加入，不受兩個裝置限制。</p>{error&&<p className="ledger-error" role="alert">{error}</p>}<button className="button danger" disabled={busy||!online} onClick={()=>void rotateLink()}>{busy?'處理中…':'確認更新私人連結'}</button><button className="button" disabled={busy} onClick={()=>setRotating(null)}>取消</button></div></Modal>}
    {deleting&&<Modal title="確認刪除紀錄" onClose={()=>{if(!busy)setDeleting(null)}}><div className="form-stack"><p>確定刪除「{deleting.title}」？兩位旅伴的結算金額將依雲端最新資料重新計算。</p><p className="muted small">若紀錄已被另一人修改，這次刪除會被拒絕，請先重新同步並檢查。</p>{error&&<p role="alert" className="ledger-error">{error}</p>}<button className="button danger" disabled={busy||!online} onClick={()=>void act(async()=>{await mutate(deleting.kind==='expense'?'delete_expense':'delete_settlement',{id:deleting.id},deleting.version);setDeleting(null)},'紀錄已刪除。')}>{busy?'處理中…':'確定刪除'}</button><button className="button" disabled={busy} onClick={()=>setDeleting(null)}>取消</button></div></Modal>}
  </div>
}
