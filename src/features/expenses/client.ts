import { createClient } from '@supabase/supabase-js'
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
export const ledgerClient = ledgerConfig.ready ? createClient(url,key,{ auth:{ flowType:'pkce', persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } }) : null
export function redirectUrl(current = location.href) { return new URL('.',current).href }
const INVITE_KEY = 'sendai-ledger-pending-invite'
export function pendingInvite() {
  const linkToken = new URLSearchParams(location.search).get('join')
  if (linkToken!==null) return /^[a-fA-F0-9]{64}$/.test(linkToken) ? linkToken.toLowerCase() : ''
  try { return sessionStorage.getItem(INVITE_KEY) ?? '' } catch { return '' }
}
let initialize: Promise<void> | undefined
export function initializeLedgerAuth() {
  return initialize ??= (async () => {
    if (!ledgerClient) return
    const here = new URL(location.href)
    const invite = here.searchParams.get('join')
    if (invite && /^[a-fA-F0-9]{64}$/.test(invite)) {
      try { sessionStorage.setItem(INVITE_KEY,invite.toLowerCase()) } catch { /* manual entry remains available */ }
      here.searchParams.delete('join')
    }
    const code = here.searchParams.get('code')
    const failed = here.searchParams.has('error') || new URLSearchParams(here.hash.slice(1)).has('error_description')
    if (code || failed) {
      here.searchParams.delete('code'); here.searchParams.delete('error'); here.searchParams.delete('error_description'); here.hash = 'expenses'
      history.replaceState(null,'',here)
      if (failed) throw new Error('登入連結已失效或被拒絕。請重新寄送，或改用 Email 驗證碼。')
      const { error } = await ledgerClient.auth.exchangeCodeForSession(code!)
      if (error) throw new Error('登入連結無法驗證。請回到原本要求登入的 Safari，或改用信中的驗證碼。')
    } else if (invite) history.replaceState(null,'',here)
  })()
}
export function clearPendingInvite() { try { sessionStorage.removeItem(INVITE_KEY) } catch { /* no cached ledger data */ } }
export function newInviteToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), v=>v.toString(16).padStart(2,'0')).join('') }
export function inviteLink(token: string) { const u = new URL(redirectUrl()); u.searchParams.set('join',token); u.hash = 'expenses'; return u.href }
