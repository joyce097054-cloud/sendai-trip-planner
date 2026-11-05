import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { initializeLedgerAuth, ledgerClient } from './client'
import type { Action, LedgerSnapshot } from './types'

export function ledgerError(error: unknown): string {
  const e = error as { code?: string; message?: string }
  if (e?.code === '40001') return '另一位旅伴或另一個裝置已修改／刪除此資料。你的輸入未覆蓋雲端，請關閉表單、重新同步後再確認。'
  if (e?.code === '42501' || e?.code === 'PGRST301') return '登入已失效或沒有這趟旅程的權限，請重新登入。'
  if (e?.code === 'PGRST202' || e?.code === '42P01') return '雲端分帳資料表尚未設定，請先依 Supabase 設定說明套用 migration。'
  if (e?.code === '23505') return '紀錄識別碼已存在。請重新同步，確認資料是否已儲存。'
  if (['23514','22008','22P02'].includes(e?.code ?? '')) return '金額、日期或成員格式不正確，請檢查輸入。'
  if (e?.code === '22023') return e.message || '輸入格式不正確。'
  return e?.message && /[\u3400-\u9fff]/.test(e.message) ? e.message : '無法連上雲端，請確認網路後重試。結果不明時請先重新同步，不要建立重複紀錄。'
}
export function useLedger() {
  const [session,setSession] = useState<Session|null>(null)
  const [authLoading,setAuthLoading] = useState(Boolean(ledgerClient))
  const [error,setError] = useState('')
  const [data,setData] = useState<LedgerSnapshot|null>(null)
  const [tripId,setTripId] = useState<string|null>(null)
  const [online,setOnline] = useState(navigator.onLine)
  const [busy,setBusy] = useState(false)
  const [loading,setLoading] = useState(false)
  const [connection,setConnection] = useState<'connecting'|'live'|'disconnected'>('connecting')
  const [updated,setUpdated] = useState('')
  const inFlight = useRef(false)
  const operations = useRef(new Map<string,string>())
  const sequence = useRef(0)
  const userId = session?.user.id
  const currentUser = useRef<string|undefined>(undefined)
  const currentTrip = useRef<string|null>(null)
  currentUser.current = session?.user.id; currentTrip.current = tripId
  useEffect(() => {
    const client=ledgerClient
    if (!client) return
    let active = true
    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      if (currentUser.current !== next?.user.id) { sequence.current++; setData(null); setTripId(null); setUpdated(''); operations.current.clear() }
      setSession(next)
    })
    void initializeLedgerAuth().then(async () => {
      const { data: auth, error: authError } = await client.auth.getSession()
      if (active) { if (authError) setError(ledgerError(authError)); else setSession(auth.session) }
    }).catch(e => { if (active) setError(ledgerError(e)) }).finally(() => { if (active) setAuthLoading(false) })
    return () => { active=false; subscription.subscription.unsubscribe() }
  },[])
  useEffect(() => {
    const up = () => setOnline(true), down = () => { setOnline(false); setConnection('disconnected') }
    window.addEventListener('online',up); window.addEventListener('offline',down)
    return () => { window.removeEventListener('online',up); window.removeEventListener('offline',down) }
  },[])
  const refresh = useCallback(async (selected?: string|null) => {
    if (!ledgerClient || !userId) return
    const user = userId, requestedTrip = selected === undefined ? tripId : selected
    const request = ++sequence.current
    setLoading(true)
    try {
      const { data: result,error: failure } = await ledgerClient.rpc('ledger_snapshot',{p_trip_id:requestedTrip}).abortSignal(AbortSignal.timeout(20000))
      if (failure) throw failure
      if (request!==sequence.current || currentUser.current!==user) return
      if (!result || result.schema_version!==1 || !Array.isArray(result.trips) || !Array.isArray(result.invites) || !Array.isArray(result.members) || !Array.isArray(result.expenses) || !Array.isArray(result.settlements)) throw new Error('雲端資料格式不正確，請檢查 migration 版本。')
      setData(result as LedgerSnapshot); setUpdated(new Date().toISOString()); setError('')
      if (result.trip?.id !== requestedTrip) setTripId(result.trip?.id ?? null)
    } catch (e) { if (request===sequence.current && currentUser.current===user) setError(ledgerError(e)) }
    finally { if (request===sequence.current) setLoading(false) }
  },[userId,tripId])
  useEffect(() => { setData(null); setUpdated(''); void refresh(); return () => { sequence.current++ } },[refresh])
  const memberIds = data?.members.map(m=>m.id).join(',') ?? ''
  useEffect(() => {
    if (!ledgerClient || !userId || !online) return
    let alive = true, debounce: ReturnType<typeof setTimeout>|undefined
    const invalidate = () => { clearTimeout(debounce); debounce=setTimeout(()=>{ if(alive) void refresh() },120) }
    let channel = ledgerClient.channel(`ledger:${userId}:${tripId ?? 'start'}:${crypto.randomUUID()}`)
    if (tripId) {
      for (const table of ['ledger_members','ledger_expenses','ledger_settlements']) channel = channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`trip_id=eq.${tripId}`},invalidate)
      channel = channel.on('postgres_changes',{event:'*',schema:'public',table:'ledger_trips',filter:`id=eq.${tripId}`},invalidate)
    }
    for (const id of new Set([userId,...memberIds.split(',').filter(Boolean)])) channel=channel.on('postgres_changes',{event:'*',schema:'public',table:'ledger_profiles',filter:`id=eq.${id}`},invalidate)
    setConnection('connecting')
    channel.subscribe(status=>{ if(!alive)return; setConnection(status==='SUBSCRIBED'?'live':'disconnected'); if(status==='SUBSCRIBED') void refresh() })
    const foreground = () => { if(document.visibilityState==='visible') void refresh() }
    const focus = () => void refresh()
    document.addEventListener('visibilitychange',foreground); window.addEventListener('focus',focus)
    // Periodic reconciliation also covers missed/coalesced notifications. No local write queue.
    const timer=setInterval(()=>{ if(document.visibilityState==='visible') void refresh() },60000)
    return () => { alive=false;clearTimeout(debounce);clearInterval(timer);document.removeEventListener('visibilitychange',foreground);window.removeEventListener('focus',focus);void ledgerClient?.removeChannel(channel) }
  },[userId,tripId,online,memberIds,refresh])
  async function mutate(action: Action,payload: Record<string,unknown>,version: number|null=null,selected: string|null=tripId) {
    if(!ledgerClient||!session) throw new Error('請先登入。')
    if(!navigator.onLine) throw new Error('目前離線，無法送出；本版不會排隊稍後自動上傳。')
    if(inFlight.current) throw new Error('上一筆操作仍在處理中，請稍候。')
    const signature=JSON.stringify([session.user.id,action,selected,version,payload])
    const id=operations.current.get(signature) ?? crypto.randomUUID(); operations.current.set(signature,id)
    inFlight.current=true;setBusy(true);setError('')
    const user=session.user.id
    try {
      const {data:result,error:failure}=await ledgerClient.rpc('ledger_command',{p_request_id:id,p_action:action,p_trip_id:selected,p_expected_version:version,p_payload:payload}).abortSignal(AbortSignal.timeout(20000))
      if(failure)throw failure
      operations.current.delete(signature)
      if(currentUser.current===user) {
        if(result?.trip_id && result.trip_id!==currentTrip.current) { setData(null);setTripId(result.trip_id) }
        else await refresh()
      }
      return result as Record<string,unknown>
    } catch(e) { throw new Error(ledgerError(e)) }
    finally { inFlight.current=false;setBusy(false) }
  }
  function selectTrip(id: string) { sequence.current++;setData(null);setUpdated('');setTripId(id) }
  return {session,authLoading,error,setError,data,busy,loading,online,connection,updated,refresh,mutate,selectTrip}
}
