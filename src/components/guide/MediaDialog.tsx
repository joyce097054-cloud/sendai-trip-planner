import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import Modal from '../Modal'

export default function MediaDialog({ title, src, alt, children, onClose }: { title: string; src: string | null; alt: string; children?: ReactNode; onClose: () => void }) {
  const [zoom,setZoom] = useState(1), [failed,setFailed] = useState(false)
  const previousFocus = useRef(document.activeElement)
  useEffect(() => () => { const previous=previousFocus.current; if(previous instanceof HTMLElement && previous.isConnected) previous.focus() },[])
  return <Modal title={title} onClose={onClose}>
    {src && !failed ? <><div className="media-tools" role="group" aria-label="圖片縮放"><button className="button" aria-label="縮小圖片" disabled={zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-.5))}><Minus size={16}/></button><output aria-live="polite">{Math.round(zoom*100)}%</output><button className="button" aria-label="放大圖片" disabled={zoom>=3} onClick={()=>setZoom(v=>Math.min(3,v+.5))}><Plus size={16}/></button><button className="text-button" onClick={()=>setZoom(1)}><RotateCcw size={14}/>原尺寸</button></div><div className="media-scroll" tabIndex={0} role="region" aria-label="可捲動圖片"><img src={src} alt={alt} style={{width:`${zoom*100}%`}} onError={()=>setFailed(true)}/></div><p className="source-date">放大後可捲動查看完整內容。</p></> : <div className="media-unavailable" role="status">{failed?'圖片無法載入，請確認檔案已加入專案。':'目前沒有優惠券圖片；這筆資料不可當作真實優惠券使用。'}</div>}
    <div className="media-description">{children}</div>
  </Modal>
}
