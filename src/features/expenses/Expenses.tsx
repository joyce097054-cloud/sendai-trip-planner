import { useState } from 'react'
import { Download, LogOut, Plus, RefreshCw, Share2, Trash2, Pencil, Wallet } from 'lucide-react'
import Modal from '../../components/Modal'
import AuthPanel from './AuthPanel'
import { ExpenseForm, NameForm, RateForm, SettlementForm } from './Forms'
import { clearPendingInvite, inviteLink, ledgerClient, ledgerConfig, newInviteToken, pendingInvite } from './client'
import { estimateTwd, summarize, yenLabel } from './domain'
import { downloadLedgerCsv } from './csv'
import { useLedger } from './useLedger'
import { expenseCategories } from './types'
import type { Expense, LedgerTrip, Settlement } from './types'

export default function Expenses() {
  const ledger=useLedger()
  const {data,session,busy,loading,online,error,setError,mutate}=ledger
  const [editingExpense,setEditingExpense]=useState<{value:Expense|null}|null>(null)
  const [editingSettlement,setEditingSettlement]=useState<{value:Settlement|null}|null>(null)
  const [editingRate,setEditingRate]=useState<LedgerTrip|null>(null)
  const [editingName,setEditingName]=useState(false)
  const [deleting,setDeleting]=useState<{kind:'expense'|'settlement';id:string;title:string;version:number}|null>(null)
  const [join,setJoin]=useState(pendingInvite)
  const [tripTitle,setTripTitle]=useState('仙台五日賞楓自由行')
  const [invite,setInvite]=useState<{trip:string;token:string;id:string;expires:string}|null>(null)
  const [message,setMessage]=useState('')
  const [payerFilter,setPayerFilter]=useState(''),[categoryFilter,setCategoryFilter]=useState(''),[order,setOrder]=useState('desc')
  const trip=data?.trip
  const members=data?.members??[]
  const name=(id:string)=>members.find(m=>m.id===id)?.name??'尚未取得成員名稱'
  let summary:ReturnType<typeof summarize>|null=null, calculationError=''
  try { if(data)summary=summarize(members,data.expenses,data.settlements) } catch(e){calculationError=(e as Error).message}
  const twd=(amount:number)=>{ if(!trip?.rate)return '尚未設定匯率';try{return `約 NT$${estimateTwd(amount,trip.rate).toLocaleString('zh-TW')}`}catch{return '匯率無法換算，請檢查設定'} }
  async function act(work:()=>Promise<unknown>,success:string) { setError('');setMessage('');try{await work();setMessage(success)}catch(e){setError((e as Error).message)} }
  async function createInvite() {
    if(!trip)return
    const token=newInviteToken()
    // Keep the generated token on a failed response, so retrying can reuse the
    // same payload/idempotency ID instead of silently issuing another invitation.
    const pending=invite?.trip===trip.id&&invite.id===''?invite.token:token
    setInvite({trip:trip.id,token:pending,id:'',expires:''})
    await act(async()=>{const result=await mutate('create_invite',{token:pending});setInvite({trip:trip.id,token:pending,id:String(result.invite_id),expires:String(result.expires_at)})},'邀請已建立，請分享給另一位旅伴。')
  }
  async function joinTrip() {
    let token=join.trim()
    try { if(token.startsWith('http'))token=new URL(token).searchParams.get('join')??'' } catch{token=''}
    if(!/^[a-fA-F0-9]{64}$/.test(token)){setError('請貼上完整邀請連結或 64 字元邀請碼。');return}
    await act(async()=>{await mutate('join_trip',{token:token.toLowerCase()},null,null);clearPendingInvite();setJoin('')},'已加入旅程，帳務將從雲端讀取。')
  }
  const activeInvite=invite&&invite.trip===trip?.id&&invite.id&&data?.invites.some(i=>i.id===invite.id&&!i.used&&!i.revoked&&new Date(i.expires_at).getTime()>Date.now())?invite:null
  const notices=<>{!online&&<div className="ledger-error" role="alert"><strong>目前離線，所有帳務送出已停用。</strong><p>本版不建立離線佇列。連線恢復後會重新讀取雲端資料，請再次確認再送出。</p></div>}{error&&<div className="ledger-error" role="alert">{error}<button className="text-button" disabled={loading||!online} onClick={()=>void ledger.refresh()}>重新同步</button></div>}{message&&<p className="ledger-message" role="status">{message}</p>}</>
  if(!ledgerConfig.ready||location.protocol==='file:')return <div className="ledger-page"><p className="eyebrow">TRAVEL LEDGER</p><h2>兩個人，一份旅行帳本</h2><section className="panel"><Wallet size={27}/><h3>雲端分帳尚未啟用</h3><p>這裡不會顯示示範消費或假旅伴。請由網站設定者完成雲端連線後，再登入使用。</p><p className="muted">既有行程、清單與照片仍可照常使用，不會因分帳尚未連接而清除。</p><details><summary>設定者指引</summary><p className="small muted">{location.protocol==='file:'?'免安裝 HTML 不提供雲端登入，請改用正式 HTTPS 網站。':ledgerConfig.error||'尚未設定 VITE_SUPABASE_URL／VITE_SUPABASE_PUBLISHABLE_KEY。請先完成 Supabase migration、登入回呼與寄信設定，再建置；不要使用私人 service role key。'}</p></details></section></div>
  if(ledger.authLoading)return <div className="ledger-page"><p role="status">正在確認登入狀態…</p></div>
  if(!session)return <div className="ledger-page"><div><p className="eyebrow">TRAVEL LEDGER</p><h2>兩個人，一份旅行帳本</h2></div>{notices}<AuthPanel online={online} onError={setError}/></div>
  if(!data)return <div className="ledger-page">{notices}<p role="status">{loading?'正在讀取雲端帳務…':'尚未取得帳務資料。'}</p><button className="button" disabled={loading||!online} onClick={()=>void ledger.refresh()}>重新讀取</button><button className="text-button" onClick={()=>void ledgerClient?.auth.signOut({scope:'local'})}>登出分帳</button></div>
  if(!data.profile)return <div className="ledger-page">{notices}<section className="panel"><h2>先讓旅伴認識你</h2><p className="muted">不使用 A／B 代稱，帳本會顯示你設定的名字。</p><NameForm profile={null} busy={busy} online={online} onSave={async(name,version)=>{await mutate('profile',{name},version,null)}}/></section><button className="text-button" onClick={()=>void ledgerClient?.auth.signOut({scope:'local'})}>登出分帳</button></div>
  const visible=data.expenses.filter(e=>(!payerFilter||e.payer_id===payerFilter)&&(!categoryFilter||e.category===categoryFilter)).sort((a,b)=>(order==='asc'?1:-1)*(a.date.localeCompare(b.date)||a.id.localeCompare(b.id)))
  return <div className="ledger-page"><div className="section-heading"><div><p className="eyebrow">A SHARED TRAVEL LEDGER</p><h2>{trip?.title??'開始一本旅行帳'}</h2></div><button className="icon-button" aria-label="重新同步帳務" disabled={loading||!online} onClick={()=>void ledger.refresh()}><RefreshCw size={19}/></button></div>
    <div className="ledger-account"><button className="text-button" onClick={()=>setEditingName(true)}>{data.profile.name} · 修改名稱</button><button className="text-button" disabled={busy} onClick={()=>void act(async()=>{const result=await ledgerClient!.auth.signOut({scope:'local'});if(result.error)throw result.error},'已登出分帳')}><LogOut size={13}/>登出</button></div>
    <div className="ledger-sync" aria-live="polite"><span>{!online?'離線':ledger.connection==='live'?'即時連線已建立':ledger.connection==='connecting'?'正在建立即時連線':'即時連線中斷，將重新連接'}</span>{ledger.updated&&<span>最近讀取 {new Date(ledger.updated).toLocaleTimeString('zh-TW',{hour12:false})}</span>}</div>
    {notices}
    <details className="panel ledger-trip-tools" open={!trip||Boolean(join)}><summary>旅程與邀請{trip?'管理':''}</summary>{data.trips.length>1&&<label className="field">目前帳本<select value={trip?.id??''} onChange={e=>{setInvite(null);setPayerFilter('');setCategoryFilter('');ledger.selectTrip(e.target.value)}}>{data.trips.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}
    {!trip&&<p className="muted">由一人建立旅程，另一人登入自己的 Email 後以邀請加入。建立者不固定為任何分帳角色。</p>}
    <form className="form-stack" onSubmit={e=>{e.preventDefault();void act(()=>mutate('create_trip',{title:tripTitle.trim()},null,null),'已建立旅程，現在可以邀請旅伴。')}}><label className="field">建立新旅程<input required maxLength={100} value={tripTitle} onChange={e=>setTripTitle(e.target.value)}/></label><button className="button" disabled={busy||!online||!tripTitle.trim()}>建立旅程</button></form>
    <form className="form-stack" onSubmit={e=>{e.preventDefault();void joinTrip()}}><label className="field">加入旅伴的旅程<input value={join} onChange={e=>setJoin(e.target.value)} required maxLength={2000} placeholder="貼上邀請連結或邀請碼" autoCapitalize="none" autoCorrect="off"/></label><button className="button" disabled={busy||!online}>驗證並加入</button></form>
    {trip&&members.length<2&&trip.owner_id===session.user.id&&<div className="ledger-invite"><h3>邀請另一位旅伴</h3><p className="muted small">連結有效 24 小時，只能使用一次；重新產生會撤銷先前未使用的邀請。旅伴需先登入並設定顯示名稱。</p><button className="button" disabled={busy||!online} onClick={()=>void createInvite()}><Share2 size={15}/>{busy?'處理中…':'產生邀請連結'}</button>{activeInvite&&<><label className="field">邀請連結<input readOnly value={inviteLink(activeInvite.token)} onFocus={e=>e.target.select()}/></label><button className="button" onClick={()=>void act(()=>navigator.clipboard.writeText(inviteLink(activeInvite.token)),'邀請連結已複製')}>複製邀請連結</button><p className="small muted">有效至 {new Date(activeInvite.expires).toLocaleString('zh-TW',{timeZone:'Asia/Tokyo',hour12:false})}（日本時間）</p></>}{data.invites.filter(i=>!i.used&&!i.revoked&&new Date(i.expires_at).getTime()>Date.now()).map(i=><button key={i.id} className="text-button danger" disabled={busy||!online} onClick={()=>void act(()=>mutate('revoke_invite',{id:i.id}),'邀請已撤銷')}>撤銷目前邀請</button>)}</div>}
    </details>
    {trip&&<>
    <p className="ledger-members">{members.map(m=><span key={m.id}>{m.name}{m.id===session.user.id?'（我）':''}</span>)}{members.length<2&&<span>等待旅伴加入</span>}</p>
    {calculationError&&<p className="ledger-error" role="alert">{calculationError}</p>}
    {summary&&<section className="ledger-summary" aria-label="分帳結算"><p className="eyebrow">HOW WE SHARE THE JOURNEY</p><p className="muted small">累計消費 <strong>{yenLabel(summary.total)}</strong> · {twd(summary.total)}</p><h3>{summary.transfer?<>{summary.transfer.from.name} 需要付給 {summary.transfer.to.name}<strong>{yenLabel(summary.transfer.amount)}</strong></>:members.length===2?'目前無需結算':'邀請旅伴，一起開始記帳'}</h3>{summary.transfer&&<p className="muted">{twd(summary.transfer.amount)}</p>}<p className="ledger-rate">目前匯率：{trip.rate?`1 JPY = ${trip.rate} TWD`:'尚未設定'}<button className="text-button" disabled={busy||!online} onClick={()=>setEditingRate({...trip})}>設定／修改</button></p><details><summary>查看兩人的付款與負擔</summary><div className="ledger-balances">{summary.balances.map(b=><div key={b.member.id}><h4>{b.member.name}</h4><p>實際付款 {yenLabel(b.paid)}</p><p>應負擔 {yenLabel(b.owed)}</p><p>已付結算 {yenLabel(b.sent)} · 已收 {yenLabel(b.received)}</p><p>目前淨餘額 {yenLabel(b.net)}</p></div>)}</div></details></section>}
    <div className="ledger-toolbar"><button className="button primary" disabled={busy||!online||members.length!==2||!!calculationError} onClick={()=>setEditingExpense({value:null})}><Plus size={17}/>新增消費</button><button className="button" disabled={busy||!online||members.length!==2||!!calculationError} onClick={()=>setEditingSettlement({value:null})}>記錄已結算</button><button className="button" disabled={!data.expenses.length&&!data.settlements.length} onClick={()=>downloadLedgerCsv(data)}><Download size={15}/>匯出 CSV</button></div>
    <section className="ledger-records"><div className="section-heading"><h3>消費紀錄</h3><span className="muted small">{visible.length} 筆</span></div><div className="ledger-filters"><label className="field">付款人篩選<select value={payerFilter} onChange={e=>setPayerFilter(e.target.value)}><option value="">全部旅伴</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="field">分類篩選<select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">全部分類</option>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select></label><label className="field">日期排序<select value={order} onChange={e=>setOrder(e.target.value)}><option value="desc">新到舊</option><option value="asc">舊到新</option></select></label></div>
    {!visible.length&&<p className="empty-state">{data.expenses.length?'這個篩選下沒有消費紀錄。':'還沒有消費紀錄。從第一筆真實支出開始。'}</p>}
    <ul className="ledger-list">{visible.map(e=><li key={e.id}><div className="ledger-record-heading"><div><time>{e.date}</time><h4>{e.title}</h4></div><strong>{yenLabel(e.amount_jpy)}</strong></div><p className="muted small">{name(e.payer_id)} 付款 · {e.category} · {e.split_mode==='equal'?'平均分攤':e.split_mode==='single'?`由 ${name(Object.keys(e.shares).find(id=>e.shares[id]===e.amount_jpy)??'')} 全額負擔`:'自訂分攤'}</p><p className="ledger-shares">{members.map(m=>`${m.name} ${yenLabel(e.shares[m.id])}`).join(' ／ ')}</p>{e.notes&&<p className="ledger-notes">{e.notes}</p>}<div className="ledger-row-actions"><button className="text-button" disabled={busy||!online} aria-label={`編輯消費 ${e.title}`} onClick={()=>setEditingExpense({value:{...e,shares:{...e.shares}}})}><Pencil size={13}/>編輯</button><button className="text-button danger" disabled={busy||!online} aria-label={`刪除消費 ${e.title}`} onClick={()=>setDeleting({kind:'expense',id:e.id,title:e.title,version:e.version})}><Trash2 size={13}/>刪除</button></div></li>)}</ul></section>
    <section className="ledger-records"><h3>實際結算紀錄</h3><p className="muted small">保留每次實際轉帳，部分結算會自動反映在上方的應付金額。這些轉帳不會增加消費總額。</p>{!data.settlements.length&&<p className="empty-state">尚無結算紀錄。</p>}<ul className="ledger-list">{[...data.settlements].sort((a,b)=>b.date.localeCompare(a.date)).map(s=><li key={s.id}><div className="ledger-record-heading"><div><time>{s.date}</time><h4>{name(s.payer_id)} → {name(s.receiver_id)}</h4></div><strong>{yenLabel(s.amount_jpy)}</strong></div>{s.notes&&<p className="ledger-notes">{s.notes}</p>}<div className="ledger-row-actions"><button className="text-button" disabled={busy||!online} aria-label={`編輯結算 ${s.date}`} onClick={()=>setEditingSettlement({value:{...s}})}>編輯</button><button className="text-button danger" disabled={busy||!online} aria-label={`刪除結算 ${s.date}`} onClick={()=>setDeleting({kind:'settlement',id:s.id,title:`${s.date} ${name(s.payer_id)} 的結算`,version:s.version})}>刪除</button></div></li>)}</ul></section>
    <p className="small muted">帳務保存在雲端；既有「資料備份」JSON 保護本機行程及照片。共同帳務可另匯出 CSV，兩種備份用途不同。</p>
    </>}
    {editingExpense&&<ExpenseForm expense={editingExpense.value} members={members} userId={session.user.id} busy={busy} online={online} onClose={()=>setEditingExpense(null)} onSave={async(value,version)=>{await mutate('save_expense',{...value},version);setEditingExpense(null);setMessage('消費已送交雲端。')}}/>}
    {editingRate&&<RateForm trip={editingRate} busy={busy} online={online} onClose={()=>setEditingRate(null)} onSave={async(rate,version)=>{await mutate('set_rate',{rate},version);setEditingRate(null);setMessage('共同匯率已儲存。')}}/>}
    {editingSettlement&&<SettlementForm entry={editingSettlement.value} members={members} defaultPayer={summary?.transfer?.from.id??session.user.id} defaultAmount={summary?.transfer?.amount??0} busy={busy} online={online} onClose={()=>setEditingSettlement(null)} onSave={async(value,version)=>{await mutate('save_settlement',{...value},version);setEditingSettlement(null);setMessage('實際結算已記錄。')}}/>}
    {editingName&&<Modal title="我的顯示名稱" onClose={()=>{if(!busy)setEditingName(false)}}><NameForm profile={data.profile} busy={busy} online={online} onSave={async(name,version)=>{await mutate('profile',{name},version,null);setEditingName(false)}}/></Modal>}
    {deleting&&<Modal title="確認刪除紀錄" onClose={()=>{if(!busy)setDeleting(null)}}><div className="form-stack"><p>確定刪除「{deleting.title}」？兩位旅伴的結算金額將依雲端最新資料重新計算。</p><p className="muted small">若紀錄已被另一人修改，這次刪除會被拒絕，請先重新同步並檢查。</p>{error&&<p role="alert" className="ledger-error">{error}</p>}<button className="button danger" disabled={busy||!online} onClick={()=>void act(async()=>{await mutate(deleting.kind==='expense'?'delete_expense':'delete_settlement',{id:deleting.id},deleting.version);setDeleting(null)},'紀錄已刪除。')}>{busy?'處理中…':'確定刪除'}</button><button className="button" disabled={busy} onClick={()=>setDeleting(null)}>取消</button></div></Modal>}
  </div>
}
