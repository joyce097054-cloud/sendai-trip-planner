import { useCallback, useEffect, useRef, useState } from 'react'
import type { ShoppingItem, ShoppingOwner } from '../../types'
import { isShoppingItem } from '../../lib/storage'
import { initializeLedgerAuth, ledgerClient, rememberPrivateLink } from '../expenses/client'

export interface CloudItem extends ShoppingItem { owner_key: ShoppingOwner; position: number; version: number }
export function shoppingError(error:unknown) {
  const e=error as {code?:string;message?:string}
  if(e?.code==='40001')return '另一支手機已修改此商品；你的輸入未覆蓋雲端。請保留輸入，重新同步後再確認。'
  if(e?.code==='PGRST202'||e?.code==='42P01')return '購物雲端功能尚未啟用：請由設定者套用 003 SQL。本機清單仍保留。'
  if(e?.code==='42501')return '沒有此旅程存取權。請使用原本或最新的私人連結重新連結。'
  return e?.message&&/[\u3400-\u9fff]/.test(e.message)?e.message:'購物同步失敗，請連線後重試；本機清單未變更。'
}
export function parseCloudItems(value:unknown): CloudItem[] {
  if(!Array.isArray(value)||value.length>4000||!value.every(i=>{const row=i as CloudItem;return isShoppingItem(i)&&['lan','treaty'].includes(row.owner_key)&&typeof row.position==='number'&&Number.isFinite(row.position)&&Number.isInteger(row.version)&&row.version>=1}))throw new Error('雲端購物資料格式不正確。')
  const keys=value.map(i=>`${i.owner_key}:${i.id}`)
  if(new Set(keys).size!==keys.length)throw new Error('雲端購物商品編號重複。')
  return value as CloudItem[]
}
export function useShoppingCloud(tripId:string|undefined,onTrip:(id:string|undefined)=>void) {
  const [items,setItems]=useState<CloudItem[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[online,setOnline]=useState(navigator.onLine),[updated,setUpdated]=useState(''),[live,setLive]=useState(false)
  const generation=useRef(0),inFlight=useRef(false),requests=useRef(new Map<string,string>()),currentTrip=useRef(tripId),mounted=useRef(true),authUser=useRef<string|null>(null)
  currentTrip.current=tripId
  const refresh=useCallback(async()=>{
    if(!ledgerClient||!tripId||!navigator.onLine)return
    const run=++generation.current
    try {
      await initializeLedgerAuth()
      const {data,error:failure}=await ledgerClient.rpc('shared_shopping_snapshot',{p_trip_id:tripId}).abortSignal(AbortSignal.timeout(20000))
      if(failure)throw failure
      const parsed=parseCloudItems(data?.items)
      if(mounted.current&&run===generation.current){setItems(parsed);setReady(true);setError('');setUpdated(new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}))}
    }catch(e){if(mounted.current&&run===generation.current){setError(shoppingError(e));setReady(false);if((e as {code?:string}).code==='42501')setItems([])}}
  },[tripId])
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++}},[])
  useEffect(()=>{
    setItems([]);setReady(false);setUpdated('');setError('');generation.current++
    if(!tripId||!ledgerClient)return
    let timer:ReturnType<typeof setTimeout>|undefined
    const invalidate=()=>{clearTimeout(timer);timer=setTimeout(()=>void refresh(),100)}
    const channel=ledgerClient.channel(`shopping:${tripId}:${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'shared_shopping_items',filter:`trip_id=eq.${tripId}`},invalidate).subscribe(status=>{setLive(status==='SUBSCRIBED');if(status==='SUBSCRIBED')void refresh()})
    void refresh()
    const foreground=()=>{if(document.visibilityState==='visible')void refresh()},up=()=>{setOnline(true);void refresh()},down=()=>{setOnline(false);setLive(false)}
    document.addEventListener('visibilitychange',foreground);window.addEventListener('focus',foreground);window.addEventListener('online',up);window.addEventListener('offline',down)
    const poll=setInterval(foreground,30000)
    const {data:auth}=ledgerClient.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||authUser.current&&authUser.current!==session?.user.id){generation.current++;setItems([]);setReady(false);setError('背景裝置驗證已變更，請重新連結私人帳本。')}authUser.current=session?.user.id??null})
    return()=>{generation.current++;clearTimeout(timer);clearInterval(poll);auth.subscription.unsubscribe();document.removeEventListener('visibilitychange',foreground);window.removeEventListener('focus',foreground);window.removeEventListener('online',up);window.removeEventListener('offline',down);void ledgerClient?.removeChannel(channel)}
  },[tripId,refresh])
  async function connect(link:string) {
    if(!ledgerClient){setError('尚未設定 Supabase 公開連線資料。');return}
    if(inFlight.current)return
    inFlight.current=true;setBusy(true);setError('')
    try {
      if(!navigator.onLine)throw new Error('目前離線，無法連結雲端購物清單。')
      await initializeLedgerAuth()
      let selected=tripId
      if(link.trim()) {
        let token=link.trim()
        if(!/^[a-f0-9]{64}$/i.test(token)){const url=new URL(token);const query=url.hash.split('?')[1]??'';token=new URLSearchParams(query).get('book')??url.searchParams.get('join')??''}
        if(!/^[a-f0-9]{64}$/i.test(token))throw new Error('請貼上完整私人旅程連結。')
        const {data,error:failure}=await ledgerClient.rpc('shared_ledger_command',{p_request_id:crypto.randomUUID(),p_action:'open_book',p_trip_id:null,p_expected_version:null,p_payload:{token:token.toLowerCase()}}).abortSignal(AbortSignal.timeout(20000))
        if(failure)throw failure
        selected=data?.trip_id
        rememberPrivateLink(token)
      }
      const {data,error:failure}=await ledgerClient.rpc('shared_ledger_snapshot',{p_trip_id:selected??null}).abortSignal(AbortSignal.timeout(20000))
      if(failure)throw failure
      if(!data?.trip?.id)throw new Error('請先在分帳建立私人帳本，或貼上原私人連結；不用註冊。')
      const {error:missing}=await ledgerClient.rpc('shared_shopping_snapshot',{p_trip_id:data.trip.id}).abortSignal(AbortSignal.timeout(20000))
      if(missing)throw missing
      onTrip(data.trip.id)
      if(data.trip.id===tripId)await refresh()
    }catch(e){setError(shoppingError(e))}finally{inFlight.current=false;setBusy(false)}
  }
  async function mutate(action:'save'|'delete',item:ShoppingItem,owner:ShoppingOwner,position:number,version:number) {
    if(!ledgerClient||!tripId||!ready)throw new Error('請先完成雲端同步，再修改商品。')
    if(!navigator.onLine)throw new Error('目前離線，雲端購物不能送出，不會排隊上傳。')
    if(inFlight.current)throw new Error('正在儲存，請稍候。')
    const payload={...item,owner_key:owner,position}
    const signature=JSON.stringify([tripId,action,version,payload]),request=requests.current.get(signature)??crypto.randomUUID()
    requests.current.set(signature,request);inFlight.current=true;setBusy(true)
    try {
      const {error:failure}=await ledgerClient.rpc('shared_shopping_command',{p_trip_id:tripId,p_request_id:request,p_action:action,p_expected_version:version,p_payload:payload}).abortSignal(AbortSignal.timeout(20000))
      if(failure)throw failure
      requests.current.delete(signature)
      if(currentTrip.current===tripId)await refresh()
    }catch(e){await refresh();throw new Error(shoppingError(e))}finally{inFlight.current=false;setBusy(false)}
  }
  return {items,error,busy,ready,online,updated,live,refresh,connect,mutate}
}
