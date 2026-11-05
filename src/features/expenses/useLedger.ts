import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { initializeLedgerAuth, ledgerClient, pendingInvite, hasPrivateLinkInUrl, rememberPrivateLink, privateTokenForTrip, clearPendingInvite } from './client'
import type { Action, LedgerSnapshot } from './types'

export function ledgerError(error:unknown):string {
  const e=error as {code?:string;message?:string}
  if(e?.code==='40001')return '另一支手機已修改或刪除此紀錄。你的輸入未覆蓋雲端，請保留內容、關閉表單並重新同步後確認。'
  if(e?.code==='42501'||e?.code==='PGRST301')return '此裝置已失去帳本存取權，或背景驗證已失效。請用最新的私人連結重新開啟。'
  if(e?.code==='PGRST202'||e?.code==='42P01')return '雲端私人帳本尚未設定，請先套用 002 migration。'
  if(e?.code==='23505')return '紀錄已存在，請先同步確認是否已儲存，不要重建相同消費。'
  if(['23514','22008','22P02'].includes(e?.code??''))return '金額、日期或分攤資料格式不正確，請檢查輸入。'
  if(e?.code==='22023')return e.message||'輸入格式不正確。'
  return e?.message&&/[\u3400-\u9fff]/.test(e.message)?e.message:'無法連上雲端，請確認網路後重試。結果不明時請先重新同步，不要建立重複紀錄。'
}
export function useLedger(){
  const [session,setSession]=useState<Session|null>(null),[authLoading,setAuthLoading]=useState(Boolean(ledgerClient))
  const [error,setError]=useState(''),[data,setData]=useState<LedgerSnapshot|null>(null),[tripId,setTripId]=useState<string|null>(null)
  const [online,setOnline]=useState(navigator.onLine),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false)
  const [blocked,setBlocked]=useState(true),[connection,setConnection]=useState<'connecting'|'live'|'disconnected'>('connecting'),[updated,setUpdated]=useState('')
  const userId=session?.user.id
  const currentUser=useRef<string|undefined>(undefined),currentTrip=useRef<string|null>(null),sequence=useRef(0),accessSequence=useRef(0)
  const inFlight=useRef(false),operations=useRef(new Map<string,string>())
  const retryRef=useRef<()=>Promise<void>>(async()=>{})
  currentUser.current=userId;currentTrip.current=tripId
  const retryAccess=useCallback(async()=>{
    if(!ledgerClient||location.protocol==='file:')return
    const run=++accessSequence.current;sequence.current++
    setAuthLoading(true);setBlocked(true);setError('');setData(null)
    const token=pendingInvite()
    try{
      if(hasPrivateLinkInUrl()&&!token)throw new Error('私人連結格式不正確，請重新貼上完整連結。')
      const s=await initializeLedgerAuth()
      if(run!==accessSequence.current)return
      if(token){
        const signature=JSON.stringify([s.user.id,'open_book',token])
        const request=operations.current.get(signature)??crypto.randomUUID();operations.current.set(signature,request)
        const {data:result,error:failure}=await ledgerClient.rpc('shared_ledger_command',{p_request_id:request,p_action:'open_book',p_trip_id:null,p_expected_version:null,p_payload:{token}}).abortSignal(AbortSignal.timeout(20000))
        if(failure)throw failure
        if(run!==accessSequence.current)return
        if(typeof result?.trip_id!=='string')throw new Error('私人連結回應格式不正確。')
        rememberPrivateLink(token,result.trip_id);setTripId(result.trip_id);operations.current.delete(signature)
      }
      setSession(s);setBlocked(false)
    }catch(e){if(run===accessSequence.current){const message=ledgerError(e);setError(message);setData(null);throw new Error(message)}}
    finally{if(run===accessSequence.current)setAuthLoading(false)}
  },[])
  retryRef.current=retryAccess
  useEffect(()=>{
    const client=ledgerClient
    if(!client||location.protocol==='file:')return
    let alive=true
    const {data:subscription}=client.auth.onAuthStateChange((event,next)=>{
      if(!alive)return
      if(currentUser.current!==next?.user.id){sequence.current++;setData(null);setTripId(null);setUpdated('');operations.current.clear()}
      setSession(next)
      if(event==='SIGNED_OUT')setTimeout(()=>{if(alive)void retryRef.current().catch(()=>{})},0)
    })
    void retryAccess().catch(()=>{})
    const changed=()=>{if(hasPrivateLinkInUrl())void retryRef.current().catch(()=>{})}
    window.addEventListener('hashchange',changed)
    return()=>{alive=false;accessSequence.current++;sequence.current++;subscription.subscription.unsubscribe();window.removeEventListener('hashchange',changed)}
  },[retryAccess])
  useEffect(()=>{
    const up=()=>setOnline(true),down=()=>{setOnline(false);setConnection('disconnected')}
    window.addEventListener('online',up);window.addEventListener('offline',down)
    return()=>{window.removeEventListener('online',up);window.removeEventListener('offline',down)}
  },[])
  const refresh=useCallback(async(selected?:string|null)=>{
    if(!ledgerClient||!userId||blocked||authLoading||!navigator.onLine)return
    const user=userId,requested=selected===undefined?tripId:selected,request=++sequence.current
    setLoading(true)
    try{
      const {data:result,error:failure}=await ledgerClient.rpc('shared_ledger_snapshot',{p_trip_id:requested}).abortSignal(AbortSignal.timeout(20000))
      if(failure)throw failure
      if(request!==sequence.current||currentUser.current!==user)return
      if(!result||result.schema_version!==1||!Array.isArray(result.trips)||!Array.isArray(result.members)||!Array.isArray(result.expenses)||!Array.isArray(result.settlements))throw new Error('雲端帳本格式不正確，請確認資料庫版本。')
      setData(result as LedgerSnapshot);setUpdated(new Date().toISOString());setError('')
      if((result.trip?.id??null)!==requested)setTripId(result.trip?.id??null)
    }catch(e){if(request===sequence.current&&currentUser.current===user){setError(ledgerError(e));if((e as {code?:string}).code==='42501'){setData(null);setBlocked(true)}}}
    finally{if(request===sequence.current)setLoading(false)}
  },[userId,tripId,blocked,authLoading])
  useEffect(()=>{setData(null);setUpdated('');void refresh();return()=>{sequence.current++}},[refresh])
  useEffect(()=>{
    if(!ledgerClient||!userId||!online||blocked||authLoading)return
    let alive=true,debounce:ReturnType<typeof setTimeout>|undefined
    const invalidate=()=>{clearTimeout(debounce);debounce=setTimeout(()=>{if(alive)void refresh()},100)}
    let channel=ledgerClient.channel(`shared-ledger:${userId}:${tripId??'start'}:${crypto.randomUUID()}`)
    if(tripId){
      for(const table of ['shared_ledger_participants','shared_ledger_expenses','shared_ledger_settlements','shared_ledger_devices'])channel=channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`trip_id=eq.${tripId}`},invalidate)
      channel=channel.on('postgres_changes',{event:'*',schema:'public',table:'shared_ledger_books',filter:`id=eq.${tripId}`},invalidate)
    }
    setConnection('connecting')
    void refresh()
    channel.subscribe(status=>{if(!alive)return;setConnection(status==='SUBSCRIBED'?'live':'disconnected');if(status==='SUBSCRIBED')void refresh()})
    const foreground=()=>{if(document.visibilityState==='visible')void refresh()},focus=()=>void refresh()
    document.addEventListener('visibilitychange',foreground);window.addEventListener('focus',focus)
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},60000)
    return()=>{alive=false;clearTimeout(debounce);clearInterval(timer);document.removeEventListener('visibilitychange',foreground);window.removeEventListener('focus',focus);void ledgerClient?.removeChannel(channel)}
  },[userId,tripId,online,blocked,authLoading,refresh])
  async function mutate(action:Action,payload:Record<string,unknown>,version:number|null=null,selected:string|null=tripId){
    if(!ledgerClient||!session)throw new Error('背景安全驗證尚未完成，請重新開啟私人連結。')
    if(!navigator.onLine)throw new Error('目前離線，無法送出；不會排隊稍後自動上傳。')
    if(inFlight.current)throw new Error('上一筆操作仍在處理中，請稍候。')
    const signature=JSON.stringify([session.user.id,action,selected,version,payload]),id=operations.current.get(signature)??crypto.randomUUID()
    operations.current.set(signature,id);inFlight.current=true;setBusy(true);setError('')
    const user=session.user.id
    try{
      const {data:result,error:failure}=await ledgerClient.rpc('shared_ledger_command',{p_request_id:id,p_action:action,p_trip_id:selected,p_expected_version:version,p_payload:payload}).abortSignal(AbortSignal.timeout(20000))
      if(failure)throw failure
      operations.current.delete(signature)
      if(currentUser.current===user){
        if(result?.trip_id&&(result.trip_id!==currentTrip.current||blocked)){setData(null);setBlocked(false);setTripId(result.trip_id)}
        else await refresh()
      }
      return result as Record<string,unknown>
    }catch(e){if((e as {code?:string}).code==='42501'){setData(null);setBlocked(true)}throw new Error(ledgerError(e))}
    finally{inFlight.current=false;setBusy(false)}
  }
  function selectTrip(id:string){
    sequence.current++;setData(null);setUpdated('');setTripId(id)
    const token=privateTokenForTrip(id)
    if(token)rememberPrivateLink(token,id)
    else{clearPendingInvite();const here=new URL(location.href);here.hash='expenses';here.searchParams.delete('join');history.replaceState(null,'',here)}
  }
  return {session,authLoading,error,setError,data,busy,loading,online,connection,updated,refresh,mutate,selectTrip,retryAccess}
}
