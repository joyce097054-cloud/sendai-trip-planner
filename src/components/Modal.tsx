import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
export default function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const previousFocus = useRef(document.activeElement)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current, previousOverflow = document.body.style.overflow
    const updateViewport = () => {
      dialog?.style.setProperty('--visual-height', `${window.visualViewport?.height ?? window.innerHeight}px`)
      dialog?.style.setProperty('--visual-top', `${window.visualViewport?.offsetTop ?? 0}px`)
    }
    updateViewport()
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    window.visualViewport?.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('scroll', updateViewport)
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('scroll', updateViewport)
      dialog?.close()
      document.body.style.overflow = previousOverflow
      const previous = previousFocus.current
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={ref} className="modal" onCancel={e => { e.preventDefault(); onClose() }} aria-labelledby={titleId} onClick={e => { if (e.target === e.currentTarget) onClose() }}><div className="modal-inner"><div className="section-heading modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="關閉"><X size={20} aria-hidden="true"/></button></div>{children}</div></dialog>
}
