import { describe,it,expect } from 'vitest'
import { freshData, upgradeLists, adoptFormalPlan } from './migration'
import { defaultDetails } from '../data/guide'
import { defaultStops, days, PLAN_REVISION, visibleStops } from '../data/itinerary'
import { isAppData, makeBackup, parseBackup } from './storage'
import type { AppData } from '../types'

describe('11/10 正式行程與無損遷移',()=>{
 it('五天方案 A 共56筆，兩方案保留必去狐狸村及18點橫綱',()=>{
   expect(days.map(d=>d.date)).toEqual(['2026-11-20','2026-11-21','2026-11-22','2026-11-23','2026-11-24'])
   expect([1,2,3,4,5].map(d=>visibleStops(defaultStops,d,'A').length)).toEqual([9,12,12,12,11])
   for(const variant of ['A','B'] as const){const day=visibleStops(defaultStops,4,variant);expect(day.find(s=>s.name.includes('狐狸村參觀'))?.start).toBe('10:30');expect(day.find(s=>s.name.includes('橫綱'))?.start).toBe('18:00')}
   expect(visibleStops(defaultStops,4,'B').some(s=>s.name.includes('神社'))).toBe(false)
   expect(days[3].tips?.join()).toContain('尚未確認訂位')
   expect(defaultStops.every(s=>s.mapQuery&&s.description&&s.transport)).toBe(true)
 })
 it('新版預設無取消的餐廳／輪王寺，航班住宿不變',()=>{
   const d=freshData(defaultDetails)
   expect(d.details).toEqual(defaultDetails);expect(d.planRevision).toBe(PLAN_REVISION)
   expect(d.stops.map(s=>s.name).join()).not.toMatch(/Matsunoya|輪王寺|牛舌料理 閣|司 西口/)
   expect(d.shopping?.lan).toHaveLength(6);expect(d.shopping?.treaty).toEqual([])
   expect(d.shopping?.lan.find(i=>i.id==='shop-shu')?.quantity).toBeNull()
   expect(d.shopping?.lan.map(i=>i.name).join()).not.toMatch(/SHIRO/)
   expect(isAppData(d)).toBe(true)
 })
 it('採用新版保留原ID、筆記、勾選和照片關聯，重跑不重複加入',async()=>{
   const base=freshData(defaultDetails),old:AppData={version:1,stops:[{...base.stops[0],id:'my-old-stop',name:'我的修改',notes:'私人筆記',done:true}],packing:[],details:{...defaultDetails,notes:'集合資訊'}}
   const snapshot=JSON.stringify(old),up=adoptFormalPlan(old)
   expect(JSON.stringify(old)).toBe(snapshot);expect(up.stops[0]).toMatchObject({id:'my-old-stop',notes:'私人筆記',done:true,archived:true})
   expect(up.details).toEqual(old.details);expect(adoptFormalPlan(up)).toBe(up)
   const backup=await makeBackup(up,[])
   backup.photos.push({id:'original-photo',stopId:'my-old-stop',caption:'原有照片',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2k0AAAAASUVORK5CYII='})
   const restored=await parseBackup(JSON.stringify(backup));expect(restored.photos[0].stopId).toBe('my-old-stop')
 })
 it('舊購物及自訂打包保留，已刪除商品不因補預設而復活',()=>{
   const old:AppData={version:1,stops:[],packing:[{id:'custom',group:'托運行李',name:'自己的外套',quantity:3,done:true},{id:'buy',group:'日本服裝購物',name:'想買的洋裝',quantity:2,done:true}],details:defaultDetails}
   const migrated=upgradeLists(old);expect(migrated.shopping?.lan).toEqual([{id:'buy',name:'想買的洋裝',quantity:2,shop:'',notes:'由舊版購物清單保留',done:true}]);expect(migrated.shopping?.treaty).toEqual([])
   expect(migrated.packing.find(p=>p.id==='custom')).toMatchObject({quantity:3,done:true});expect(migrated.packing.some(p=>p.id==='buy')).toBe(false)
   expect(upgradeLists(migrated)).toBe(migrated);expect(isAppData(migrated)).toBe(true)
 })
 it('v1 備份含雙方案及兩份購物資料；拒絕不合法新增欄位',async()=>{
   const data=freshData(defaultDetails);data.day4Plan='B';data.shopping!.treaty.push({id:'treaty-personal',name:'紀念品',quantity:2,shop:'仙台站',notes:'朋友',done:true})
   expect((await parseBackup(JSON.stringify(await makeBackup(data,[])))).data).toEqual(data)
   expect(isAppData({...data,day4Plan:'C'})).toBe(false)
   expect(isAppData({...data,shopping:undefined})).toBe(false)
   expect(isAppData({...data,shopping:{...data.shopping,lan:[{...data.shopping!.lan[0],quantity:1.5}]}})).toBe(false)
   expect(isAppData({...data,shopping:{lan:[data.shopping!.lan[0],data.shopping!.lan[0]],treaty:[]}})).toBe(false)
 })
})
