import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Minus, Plus, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '../Modal'

export default function MediaDialog({ title, src, alt, children, onClose, images, fullScreen = false }: { title: string; src: string | null; alt: string; children?: ReactNode; onClose: () => void; images?: string[]; fullScreen?: boolean }) {
  const [zoom,setZoom] = useState(1), [failed,setFailed] = useState(false)
  const [index,setIndex] = useState(0), touch = useRef<{x:number;y:number}|null>(null)
  const sources = images?.length ? images : src ? [src] : []
  const active = sources[index] ?? null
  function change(offset:number) { setIndex(v=>(v+offset+sources.length)%sources.length);setFailed(false);setZoom(1) }
  const previousFocus = useRef(document.activeElement)
  useEffect(() => () => { const previous=previousFocus.current; if(previous instanceof HTMLElement && previous.isConnected) previous.focus() },[])
  return <Modal title={title} onClose={onClose} fullScreen={fullScreen}>
    {sources.length>1&&<div className="coupon-gallery" role="group" aria-label="優惠券圖片切換"><button className="button" aria-label="上一張優惠券圖片" onClick={()=>change(-1)}><ChevronLeft size={18}/></button><span aria-live="polite">第 {index+1} / {sources.length} 張</span><button className="button" aria-label="下一張優惠券圖片" onClick={()=>change(1)}><ChevronRight size={18}/></button></div>}
    {active && !failed ? <><div className="media-tools" role="group" aria-label="圖片縮放"><button className="button" aria-label="縮小圖片" disabled={zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-.5))}><Minus size={16}/></button><output aria-live="polite">{Math.round(zoom*100)}%</output><button className="button" aria-label="放大圖片" disabled={zoom>=6} onClick={()=>setZoom(v=>Math.min(6,v+.5))}><Plus size={16}/></button><button className="text-button" onClick={()=>setZoom(1)}><RotateCcw size={14}/>原尺寸</button></div><div className="media-scroll" tabIndex={0} role="region" aria-label="可捲動圖片" onTouchStart={e=>{const t=e.touches[0];touch.current={x:t.clientX,y:t.clientY}}} onTouchEnd={e=>{if(!touch.current||sources.length<2||zoom>1)return;const t=e.changedTouches[0],dx=t.clientX-touch.current.x,dy=t.clientY-touch.current.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)change(dx<0?1:-1);touch.current=null}}><img key={active} src={active} alt={alt} style={{width:`${zoom*100}%`}} onError={()=>setFailed(true)}/></div><p className="source-date">原圖未裁切。放大後可捲動；多張圖片在未放大時可左右滑動切換。</p></> : <div className="media-unavailable" role="status">{failed?'圖片無法載入，請確認檔案已加入專案。':'目前沒有優惠券圖片；這筆資料不可當作真實優惠券使用。'}</div>}
    <div className="media-description">{children}</div>
  </Modal>
}
