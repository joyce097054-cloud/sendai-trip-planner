import { useState } from 'react'
import { ArrowDown, ArrowUp, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ShoppingItem, ShoppingLists as Lists, ShoppingOwner } from '../../types'
import { downloadJson, isShoppingItem } from '../../lib/storage'
import Modal from '../../components/Modal'
import { useShoppingCloud, type CloudItem } from './cloud'

const names={lan:'藍',treaty:'條約'}
export default function ShoppingLists({lists,onChange,cloudTrip,onCloudTrip}:{lists:Lists;onChange:(v:Lists)=>void;cloudTrip?:string;onCloudTrip:(id:string|undefined)=>void}) {
  const [owner,setOwner]=useState<ShoppingOwner>('lan'),[link,setLink]=useState(''),[message,setMessage]=useState('')
  const [editing,setEditing]=useState<{item:ShoppingItem;version:number;position:number}|null>(null),[saving,setSaving]=useState(false)
  const cloud=useShoppingCloud(cloudTrip,onCloudTrip)
  const items:ShoppingItem[]=cloudTrip?cloud.items.filter(i=>i.owner_key===owner):lists[owner]
  const completed=items.filter(i=>i.done).length
  const disabled=Boolean(cloudTrip&&(!cloud.ready||!cloud.online||cloud.busy))||saving
  function begin(item?:ShoppingItem) {
    const c=item as CloudItem|undefined
    setMessage('');setEditing({item:item?{...item}:{id:crypto.randomUUID(),name:'',quantity:1,shop:'',notes:'',done:false},version:cloudTrip?(c?.version??0):0,position:c?.position??((items.at(-1) as CloudItem|undefined)?.position??0)+1000})
  }
  async function save(item:ShoppingItem,version=0,position=0,action:'save'|'delete'='save') {
    if(!isShoppingItem(item)||!item.name.trim())throw new Error('請確認名稱、數量、店家與備註格式。')
    if(cloudTrip)await cloud.mutate(action,item,owner,position,version)
    else onChange({...lists,[owner]:action==='delete'?items.filter(i=>i.id!==item.id):items.some(i=>i.id===item.id)?items.map(i=>i.id===item.id?item:i):[...items,item]})
  }
  async function change(item:ShoppingItem,patch:Partial<ShoppingItem>,action:'save'|'delete'='save') {
    setMessage('');try{const c=item as CloudItem;await save({...item,...patch},c.version??0,c.position??0,action)}catch(e){setMessage((e as Error).message)}
  }
  async function move(index:number,offset:number) {
    const target=index+offset;if(target<0||target>=items.length)return
    if(!cloudTrip){const list=[...items];[list[index],list[target]]=[list[target],list[index]];onChange({...lists,[owner]:list});return}
    const rows=items as CloudItem[],edge=rows[target].position,neighbor=rows[target+offset]?.position
    const rank=neighbor===undefined?edge+offset*1000:neighbor===edge?edge+offset*.5:(edge+neighbor)/2
    try{await save(rows[index],rows[index].version,rank)}catch(e){setMessage((e as Error).message)}
  }
  async function importLocal() {
    if(!confirm(`將此裝置「${names[owner]}」的商品逐筆加入雲端？已有相同編號的商品不覆寫；本機原清單保留。`))return
    setSaving(true);setMessage('')
    let count=0
    try {for(const item of lists[owner]){if(cloud.items.some(i=>i.owner_key===owner&&i.id===item.id))continue;await cloud.mutate('save',item,owner,((items.at(-1) as CloudItem|undefined)?.position??0)+(++count)*1000,0)}setMessage(`已加入 ${count} 項，本機清單保留。`)}catch(e){setMessage(`部分匯入已保留，請同步確認後再試：${(e as Error).message}`)}finally{setSaving(false)}
  }
  return <section id="guide-shopping" aria-labelledby="shopping-title">
    <div className="section-heading"><h3 id="shopping-title">日本購物清單</h3><span className="muted small">{cloudTrip?'私人旅程雲端清單':'此裝置 · 尚未跨裝置同步'}</span></div>
    <div className="shopping-owner-tabs" role="group" aria-label="購物清單主人">{(['lan','treaty'] as const).map(key=><button className="button" key={key} aria-pressed={owner===key} onClick={()=>{setOwner(key);setEditing(null);setMessage('')}}>{names[key]}的購物清單</button>)}</div>
    <div className="packing-progress"><span>{names[owner]}的購物進度</span><strong>{completed} / {items.length} 已購買</strong></div><progress aria-label={`${names[owner]}購物完成比例`} max={items.length||1} value={completed}/>
    {cloudTrip&&<div className="notice" role="status">{!cloud.online?'目前離線，雲端購物不能送出。':cloud.ready?`${cloud.live?'即時連線':'定期核對'} · 最近同步 ${cloud.updated}`:'正在取得雲端清單；連線完成前不能修改。'}<button className="text-button" disabled={cloud.busy||!cloud.online} onClick={()=>void cloud.refresh()}>重新同步購物清單</button></div>}
    {(message||cloud.error)&&<p role="alert" className="field-error">{message||cloud.error}</p>}
    <ul className="shopping-list">{items.map((item,index)=><li key={item.id} className={item.done?'is-complete':''}><div className="shopping-item-main"><label className="packing-check"><input type="checkbox" checked={item.done} disabled={disabled} onChange={()=>void change(item,{done:!item.done})}/><span>{item.name}</span></label><p className="muted small">{item.shop||'購買店家待決定'}{item.notes&&` · ${item.notes}`}</p></div><div className="shopping-item-actions"><button className="icon-button" aria-label={`減少 ${item.name} 數量`} disabled={disabled||item.quantity===null||item.quantity<=1} onClick={()=>void change(item,{quantity:item.quantity!-1})}><Minus size={14}/></button><span>{item.quantity??'待定'}</span><button className="icon-button" aria-label={`增加 ${item.name} 數量`} disabled={disabled||(item.quantity??0)>=999} onClick={()=>void change(item,{quantity:(item.quantity??0)+1})}><Plus size={14}/></button><button className="icon-button" aria-label={`編輯 ${item.name}`} disabled={disabled} onClick={()=>begin(item)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={`刪除 ${item.name}`} disabled={disabled} onClick={()=>{if(confirm(`確定刪除「${item.name}」？`))void change(item,{},'delete')}}><Trash2 size={15}/></button><button className="icon-button" aria-label={`上移 ${item.name}`} disabled={disabled||index===0} onClick={()=>void move(index,-1)}><ArrowUp size={14}/></button><button className="icon-button" aria-label={`下移 ${item.name}`} disabled={disabled||index===items.length-1} onClick={()=>void move(index,1)}><ArrowDown size={14}/></button></div></li>)}</ul>
    {!items.length&&(!cloudTrip||cloud.ready)&&<p className="empty-state">還沒有想買的東西，新增第一項購物清單吧！</p>}
    <button className="button" disabled={disabled} onClick={()=>begin()}><Plus size={16}/>新增商品</button>
    <details className="shopping-sync-settings"><summary>保存、備份與私人旅程同步</summary><p className="muted small">本機兩份清單分開保存。連結後使用同一私人帳本的授權，兩位旅伴均可編輯兩份清單；「藍／條約」是清單分類，不是存取密碼。雲端需先套用 003 SQL。</p>{!cloudTrip?<><label className="field">私人旅程連結（已有裝置授權可留白）<input type="text" value={link} onChange={e=>setLink(e.target.value)} autoComplete="off" placeholder="貼上原私人旅程連結"/></label><button className="button" disabled={cloud.busy} onClick={()=>void cloud.connect(link)}>連結私人帳本的購物清單</button></>:<div className="button-row"><button className="button" disabled={disabled} onClick={()=>void importLocal()}>將此裝置的{names[owner]}清單加入雲端</button><button className="text-button" onClick={()=>{onCloudTrip(undefined);setEditing(null)}}>返回本機購物清單</button></div>}
    <button className="text-button" onClick={()=>{const data=cloudTrip?{lan:cloud.items.filter(i=>i.owner_key==='lan'),treaty:cloud.items.filter(i=>i.owner_key==='treaty')}:lists;downloadJson({format:'sendai-shopping-backup',version:1,exportedAt:new Date().toISOString(),lists:data},'日本購物清單備份.json')}} disabled={Boolean(cloudTrip&&!cloud.ready)}>匯出目前兩份購物清單 JSON</button>
    <label className="button">匯入購物 JSON 至本機<input type="file" hidden accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>4*1024*1024)throw new Error('檔案超過 4 MB。');const b=JSON.parse(await file.text());if(b.format!=='sendai-shopping-backup'||b.version!==1||!b.lists||!['lan','treaty'].every(k=>Array.isArray(b.lists[k])&&b.lists[k].length<=2000&&b.lists[k].every(isShoppingItem)&&new Set(b.lists[k].map((i:ShoppingItem)=>i.id)).size===b.lists[k].length))throw new Error('不是有效的購物清單備份。');if(confirm('取代此裝置兩份購物清單？雲端資料不會改動，請先匯出原資料。')){onChange(b.lists);onCloudTrip(undefined)}}catch(err){setMessage((err as Error).message)}}}/></label>
    <p className="muted small">完整旅行 JSON 包含本機購物清單。雲端清單請另行匯出上方購物 JSON；匯入後可逐筆加入雲端，不會整本覆寫。</p></details>
    {editing&&<Modal title={`編輯${names[owner]}的商品`} onClose={()=>{if(!saving)setEditing(null)}}><form className="form-stack" onSubmit={async e=>{e.preventDefault();setSaving(true);setMessage('');try{await save({...editing.item,name:editing.item.name.trim()},editing.version,editing.position);setEditing(null)}catch(err){setMessage((err as Error).message)}finally{setSaving(false)}}}>{message&&<p role="alert" className="field-error">{message}</p>}<label className="field">商品名稱<input required autoFocus maxLength={200} value={editing.item.name} onChange={e=>setEditing({...editing,item:{...editing.item,name:e.target.value}})}/></label><label className="field">購買數量（留白為待定）<input type="number" min={1} max={999} step={1} value={editing.item.quantity??''} onChange={e=>setEditing({...editing,item:{...editing.item,quantity:e.target.value===''?null:Number(e.target.value)}})}/></label><label className="field">預計購買店家<input maxLength={300} value={editing.item.shop} onChange={e=>setEditing({...editing,item:{...editing.item,shop:e.target.value}})}/></label><label className="field">商品備註<textarea maxLength={5000} value={editing.item.notes} onChange={e=>setEditing({...editing,item:{...editing.item,notes:e.target.value}})}/></label><button className="button primary" disabled={saving||Boolean(cloudTrip&&(!cloud.online||!cloud.ready))}>{saving?'儲存中…':'儲存商品'}</button></form></Modal>}
  </section>
}
