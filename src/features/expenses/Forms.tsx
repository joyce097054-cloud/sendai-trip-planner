import { useState } from 'react'
import Modal from '../../components/Modal'
import { normalizeRate, parseYen, splitExpense, todayInJapan, validDate, yenLabel } from './domain'
import { expenseCategories } from './types'
import type { Expense, ExpenseInput, LedgerTrip, Member, Settlement } from './types'

export function NamesForm({trip,members,busy,online,onSave,onClose}:{trip:LedgerTrip;members:Member[];busy:boolean;online:boolean;onSave:(names:string[],version:number)=>Promise<void>;onClose:()=>void}) {
  const [names,setNames]=useState(()=>members.map(m=>m.name)),[version]=useState(trip.version),[error,setError]=useState('')
  return <Modal title="兩位旅伴的名稱" onClose={()=>{if(!busy)onClose()}}><form className="form-stack" onSubmit={e=>{e.preventDefault();setError('');const clean=names.map(n=>n.trim());if(clean.length!==2||clean.some(n=>!n)){setError('請填寫兩位旅伴的名稱。');return}void onSave(clean,version).catch(e=>setError(e.message))}}><p className="muted small">名稱只用於辨認付款人，不是會員或手機身分。修改名稱不會改變原有消費的歸屬。</p>{members.map((m,index)=><label className="field" key={m.id}>旅伴 {index+1} 名稱<input required maxLength={40} value={names[index]??''} onChange={e=>setNames(names.map((n,i)=>i===index?e.target.value:n))}/></label>)}{error&&<p className="ledger-error" role="alert">{error}</p>}<button className="button primary" disabled={busy||!online}>{busy?'儲存中…':'儲存兩人名稱'}</button></form></Modal>
}

export function ExpenseForm({expense,members,busy,online,onClose,onSave}:{expense:Expense|null;members:Member[];busy:boolean;online:boolean;onClose:()=>void;onSave:(value:ExpenseInput,version:number|null)=>Promise<void>}) {
  const [id]=useState(()=>expense?.id??crypto.randomUUID())
  const [title,setTitle]=useState(expense?.title??''),[amount,setAmount]=useState(expense?String(expense.amount_jpy):'')
  const [payer,setPayer]=useState(expense?.payer_id??''),[date,setDate]=useState(expense?.date??todayInJapan())
  const [choice,setChoice]=useState(expense?.split_mode==='single'?`single:${members.find(m=>expense.shares[m.id]===expense.amount_jpy)?.id}`:expense?.split_mode??'equal')
  const [custom,setCustom]=useState<Record<string,string>>(()=>Object.fromEntries(members.map(m=>[m.id,expense?String(expense.shares[m.id]):''])))
  const [category,setCategory]=useState(expense?.category??'其他'),[notes,setNotes]=useState(expense?.notes??''),[error,setError]=useState('')
  const mode=choice.startsWith('single:')?'single':choice==='custom'?'custom':'equal'
  let preview=''
  try { const shares=splitExpense(parseYen(amount),payer,members,mode,choice.split(':')[1],mode==='custom'?Object.fromEntries(members.map(m=>[m.id,parseYen(custom[m.id],true)])):undefined); preview=members.map(m=>`${m.name} ${yenLabel(shares[m.id])}`).join(' ／ ') } catch { /* incomplete input, not a fake estimate */ }
  async function save() {
    setError('')
    try {
      if(!validDate(date))throw new Error('請填寫有效日期。')
      if(!title.trim())throw new Error('請填寫消費名稱。')
      const total=parseYen(amount)
      const shares=mode==='custom'?Object.fromEntries(members.map(m=>[m.id,parseYen(custom[m.id],true)])):undefined
      splitExpense(total,payer,members,mode,choice.split(':')[1],shares)
      await onSave({id,title:title.trim(),amount_jpy:total,payer_id:payer,date,split_mode:mode,single_member_id:mode==='single'?choice.split(':')[1]:undefined,shares,category,notes},expense?.version??null)
    } catch(e) {setError((e as Error).message)}
  }
  return <Modal title={expense?'編輯消費':'記下一筆消費'} onClose={()=>{if(!busy)onClose()}}><form className="form-stack" onSubmit={e=>{e.preventDefault();void save()}}><label className="field">消費名稱<input autoFocus required maxLength={150} value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：松島午餐"/></label><div className="field-row"><label className="field">金額（JPY）<input inputMode="numeric" required pattern="[0-9]+" maxLength={10} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="整數日圓"/></label><label className="field">付款人<select required value={payer} onChange={e=>setPayer(e.target.value)}><option value="" disabled>選擇誰付款</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div><div className="field-row"><label className="field">日期<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label className="field">分類<select value={category} onChange={e=>setCategory(e.target.value as typeof category)}>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select></label></div><label className="field">分攤方式<select value={choice} onChange={e=>setChoice(e.target.value)}><option value="equal">兩人平均（多出的 1 圓由付款人負擔）</option>{members.map(m=><option key={m.id} value={`single:${m.id}`}>全部由 {m.name} 負擔</option>)}<option value="custom">自訂金額</option></select></label>{mode==='custom'&&<div className="field-row">{members.map(m=><label className="field" key={m.id}>{m.name} 應負擔 JPY<input required inputMode="numeric" pattern="[0-9]+" maxLength={10} value={custom[m.id]} onChange={e=>setCustom({...custom,[m.id]:e.target.value})}/></label>)}</div>}{preview&&<p className="ledger-split-preview">{preview}</p>}<label className="field">備註（選填）<textarea maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>{error&&<p className="ledger-error" role="alert">{error}</p>}{!online&&<p role="alert" className="ledger-error">目前離線，無法送出。請保持表單開啟，連線後再確認。</p>}<button className="button primary" disabled={busy||!online}>{busy?'正在送交雲端…':'儲存消費'}</button></form></Modal>
}

export function RateForm({trip,busy,online,onSave,onClose}:{trip:LedgerTrip;busy:boolean;online:boolean;onSave:(rate:string,version:number)=>Promise<void>;onClose:()=>void}) {
  const [rate,setRate]=useState(trip.rate??''),[error,setError]=useState('')
  return <Modal title="共同使用的日圓匯率" onClose={()=>{if(!busy)onClose()}}><form className="form-stack" onSubmit={e=>{e.preventDefault();setError('');try {const normalized=normalizeRate(rate);void onSave(normalized,trip.version).catch(e=>setError(e.message))}catch(e){setError((e as Error).message)}}}><label className="field">1 JPY = TWD<input inputMode="decimal" required value={rate} onChange={e=>setRate(e.target.value)} placeholder="填入你們約定的匯率，不自動預設"/></label><p className="muted small">兩位旅伴共用此匯率。台幣金額是估算，四捨五入至整數；實際結算仍以日圓為準。</p>{error&&<p role="alert" className="ledger-error">{error}</p>}<button className="button primary" disabled={busy||!online}>{busy?'儲存中…':'儲存共同匯率'}</button></form></Modal>
}

export function SettlementForm({entry,members,defaultPayer,defaultAmount,busy,online,onSave,onClose}:{entry:Settlement|null;members:Member[];defaultPayer:string;defaultAmount:number;busy:boolean;online:boolean;onSave:(value:Omit<Settlement,'trip_id'|'version'>,version:number|null)=>Promise<void>;onClose:()=>void}) {
  const [id]=useState(()=>entry?.id??crypto.randomUUID())
  const [payer,setPayer]=useState(entry?.payer_id??defaultPayer),[amount,setAmount]=useState(entry?String(entry.amount_jpy):defaultAmount?String(defaultAmount):'')
  const [date,setDate]=useState(entry?.date??todayInJapan()),[notes,setNotes]=useState(entry?.notes??''),[error,setError]=useState('')
  const receiver=payer?members.find(m=>m.id!==payer):undefined
  return <Modal title={entry?'編輯實際結算':'記錄實際已結算金額'} onClose={()=>{if(!busy)onClose()}}><form className="form-stack" onSubmit={e=>{e.preventDefault();setError('');try {if(!validDate(date))throw new Error('請填寫有效日期。');const n=parseYen(amount);if(!payer||!receiver)throw new Error('請選擇實際付款的旅伴。');void onSave({id,payer_id:payer,receiver_id:receiver.id,amount_jpy:n,date,notes},entry?.version??null).catch(e=>setError(e.message))}catch(e){setError((e as Error).message)}}}><label className="field">實際付款人<select required value={payer} onChange={e=>setPayer(e.target.value)}><option value="" disabled>選擇誰付款</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><p className="small muted">收款人：{receiver?.name??'選擇付款人後顯示'}。只記錄已實際轉交的金額，可以部分結算，不會刪除原始消費。</p><div className="field-row"><label className="field">已結算日圓<input required inputMode="numeric" pattern="[0-9]+" maxLength={10} value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="field">結算日期<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div><label className="field">結算備註<textarea maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>{error&&<p className="ledger-error" role="alert">{error}</p>}<button className="button primary" disabled={busy||!online}>{busy?'儲存中…':'儲存結算紀錄'}</button></form></Modal>
}
