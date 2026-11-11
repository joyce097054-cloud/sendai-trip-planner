import type { AppData } from '../types'
import { defaultPacking, defaultShopping, packingGroups } from '../data/lists'
import { defaultStops, PLAN_REVISION } from '../data/itinerary'

// Pure, additive upgrade. Never erase the original stored string on read.
export function upgradeLists(data: AppData): AppData {
  if (data.listsRevision === 2 && data.shopping) return data
  const shopping = data.shopping ?? { lan: data.packing.filter(p => /購物/.test(p.group)).map(p => ({id:p.id,name:p.name,quantity:p.quantity,shop:'',notes:'由舊版購物清單保留',done:p.done})), treaty: [] }
  const kept = data.packing.filter(p => !/購物/.test(p.group)).map(p => ({...p,group:packingGroups.includes(p.group)?p.group:/藥/.test(p.name)?'藥品類':/電|手機|相機/.test(p.name)?'電器類':/衣|襪|外套|圍巾|鞋/.test(p.name)?'衣物類':'文件類'}))
  const names = new Set(kept.map(p => p.name))
  const available = Math.max(0, 2000 - kept.length)
  const additions = defaultPacking.filter(p => !names.has(p.name) && !kept.some(k=>k.id===p.id)).slice(0, available)
  return {...data,listsRevision:2,shopping,packing:[...kept,...additions.map(p=>({...p}))]}
}
export function freshData(details: AppData['details']): AppData {
  return { version:1,planRevision:PLAN_REVISION,day4Plan:'A',listsRevision:2,stops:defaultStops.map(s=>({...s,tags:[...s.tags]})),packing:defaultPacking.map(p=>({...p})),shopping:defaultShopping(),details:{...details} }
}
export function adoptFormalPlan(data: AppData): AppData {
  if (data.planRevision === PLAN_REVISION) return data
  if (data.stops.length + defaultStops.length > 1000) throw new Error('保留舊行程後將超過 1000 筆儲存上限，尚未載入新版。請先確認完整備份，再整理不需要的舊行程；原有資料未變更。')
  const old = data.stops.map(s=>({...s,archived:true}))
  const ids = new Set(old.map(s=>s.id))
  const added = defaultStops.map(s => {
    let id = s.id, suffix = 0
    while (ids.has(id)) id = `${s.id}-formal-${++suffix}`
    ids.add(id)
    return {...s,id,tags:[...s.tags]}
  })
  return {...data,planRevision:PLAN_REVISION,planUpdateDismissed:false,day4Plan:'A',stops:[...old,...added]}
}
