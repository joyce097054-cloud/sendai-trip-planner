import { useState } from 'react'
import { Mail } from 'lucide-react'
import { ledgerClient, redirectUrl } from './client'
export default function AuthPanel({online,onError}:{online:boolean;onError:(m:string)=>void}) {
  const [email,setEmail]=useState(''), [code,setCode]=useState(''), [busy,setBusy]=useState(false), [sent,setSent]=useState(false)
  async function send() {
    if(!ledgerClient||busy||!navigator.onLine)return
    setBusy(true);onError('')
    try {
      const {error}=await ledgerClient.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:redirectUrl()}})
      if(error)throw error
      setSent(true)
    } catch { onError('登入信寄送失敗。請確認信箱、網路及 Supabase 寄信設定後重試。') }
    finally{setBusy(false)}
  }
  async function verify() {
    if(!ledgerClient||busy||!navigator.onLine)return
    setBusy(true);onError('')
    try { const {error}=await ledgerClient.auth.verifyOtp({email:email.trim(),token:code.trim(),type:'email'}); if(error)throw error }
    catch { onError('驗證碼無效或已過期，請重新確認最新的登入信。若信中只有連結，需由管理者加入驗證碼 Email 範本。') }
    finally{setBusy(false)}
  }
  return <section className="panel ledger-login"><Mail size={26}/><h3>與旅伴共用一份帳本</h3><p className="muted">各自以自己的 Email 登入，再用邀請連結加入同一趟旅程。行程與照片仍保留在原來的裝置。</p><form className="form-stack" onSubmit={e=>{e.preventDefault();void send()}}><label className="field">Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setSent(false)}}/></label><button className="button primary" disabled={busy||!online}>{busy?'處理中…':sent?'重新寄送登入信':'寄送登入連結'}</button></form>{sent&&<div className="ledger-login-hint" role="status"><p>已送出寄信請求，請查看收件匣與垃圾郵件。使用同一台裝置、原本的 Safari 開啟連結。</p><p className="small muted">若系統寄信設定尚未完成，可能收不到信；此提示不代表已成功登入。</p><form className="form-stack" onSubmit={e=>{e.preventDefault();void verify()}}><label className="field">或輸入信中的驗證碼<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required value={code} onChange={e=>setCode(e.target.value)} minLength={6} maxLength={10}/></label><button className="button" disabled={busy||!online}>以驗證碼登入</button></form></div>}</section>
}
