import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
export const ledgerConfig = { ready: Boolean(url && key), error: '' }
try {
  if (url) {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname))) throw new Error()
    if (parsed.pathname!=='/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error()
  }
} catch { ledgerConfig.ready = false; ledgerConfig.error = 'Supabase Project URL 須使用專案根網址，不加 /rest/v1/、查詢參數或帳密。' }
if (key.startsWith('sb_secret_')) { ledgerConfig.ready = false; ledgerConfig.error = '不得在前端使用私人 Secret key。' }
export const ledgerClient = ledgerConfig.ready ? createClient(url,key,{ auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false} }) : null
export function redirectUrl(current = location.href) { return new URL('.',current).href }
const PENDING='sendai-private-book-link'
let memoryPending=''
const memoryTokens=new Map<string,string>()
const valid=(token:string)=>/^[a-fA-F0-9]{64}$/.test(token)
export function pendingInvite() {
  const fragment=location.hash.slice(1), index=fragment.indexOf('?')
  const value=(index>=0?new URLSearchParams(fragment.slice(index+1)).get('book'):null) ?? new URLSearchParams(location.search).get('join')
  if(value!==null)return valid(value)?value.toLowerCase():''
  if(memoryPending)return memoryPending
  try{const stored=sessionStorage.getItem(PENDING)??'';return valid(stored)?stored:''}catch{return ''}
}
export function hasPrivateLinkInUrl() { return /[?&]book=/.test(location.hash) || new URLSearchParams(location.search).has('join') }
export function privateTokenForTrip(id:string) {if(memoryTokens.has(id))return memoryTokens.get(id)!;try{const token=sessionStorage.getItem(`${PENDING}:${id}`)??'';return valid(token)?token:''}catch{return ''}}
export function rememberPrivateLink(token:string,tripId?:string) {
  if(!valid(token))throw new Error('私人連結格式不正確。')
  token=token.toLowerCase()
  memoryPending=token;if(tripId)memoryTokens.set(tripId,token)
  try{sessionStorage.setItem(PENDING,token);if(tripId)sessionStorage.setItem(`${PENDING}:${tripId}`,token)}catch{/* Original private link remains usable without browser storage. */}
  if(tripId){const here=new URL(location.href);here.searchParams.delete('join');here.hash=`expenses?book=${token}`;history.replaceState(null,'',here)}
}
export function clearPendingInvite(){memoryPending='';try{sessionStorage.removeItem(PENDING)}catch{/* no ledger data is stored here */}}
export function newInviteToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')}
export function inviteLink(token:string){const u=new URL(redirectUrl());u.hash=`expenses?book=${token}`;return u.href}
let starting:Promise<Session>|null=null
export function initializeLedgerAuth():Promise<Session> {
  if(starting)return starting
  starting=(async()=>{
    if(!ledgerClient)throw new Error('雲端分帳尚未設定。')
    const {data,error}=await ledgerClient.auth.getSession()
    if(error)throw new Error('裝置安全驗證暫時無法恢復，請檢查網路後重新嘗試。')
    if(data.session)return data.session
    if(!navigator.onLine)throw new Error('目前離線，請連線後再開啟私人帳本。')
    const result=await ledgerClient.auth.signInAnonymously()
    if(result.error||!result.data.session)throw new Error('無法建立背景安全驗證。請確認網路，並由設定者在 Supabase 開啟 Anonymous Sign-Ins；不需要 Email 或 SMTP。')
    return result.data.session
  })().finally(()=>{starting=null})
  return starting
}
