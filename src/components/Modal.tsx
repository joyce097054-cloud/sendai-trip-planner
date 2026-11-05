import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
export default function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous } }, [])
  return <dialog ref={ref} className="modal" onCancel={e => { e.preventDefault(); onClose() }} aria-label={title} onClick={e => { if (e.target === e.currentTarget) onClose() }}><div className="modal-inner"><div className="section-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="關閉"><X size={20}/></button></div>{children}</div></dialog>
}
