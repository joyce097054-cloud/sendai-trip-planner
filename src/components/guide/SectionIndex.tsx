import { useEffect, useState } from 'react'

const sections = [
  { id: 'packing-title', label: '行李與購物' },
  { id: 'practical-title', label: '交通與景點' },
  { id: 'guide-coupons', label: '優惠券' },
  { id: 'guide-tax-refund', label: '免稅教學' },
  { id: 'travel-title', label: '旅行資料' },
  { id: 'reminders-title', label: '旅遊注意事項' },
  { id: 'emergency-title', label: '緊急資訊' },
]

export default function SectionIndex() {
  const [active, setActive] = useState(sections[0].id)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
    }, { rootMargin: '-15% 0px -60% 0px' })
    for (const section of sections) {
      const target = document.getElementById(section.id)
      if (target) observer.observe(target)
    }
    return () => observer.disconnect()
  }, [])
  function jump(id: string) {
    const target = document.getElementById(id)
    if (!target) return
    let parent: HTMLElement | null = target
    while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement }
    setActive(id)
    target.tabIndex = -1
    target.focus({ preventScroll: true })
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
  return <nav className="guide-quick-nav" aria-label="旅行指南章節"><span className="index-label">CONTENTS</span>{sections.map((item, i) => <button key={item.id} aria-current={active === item.id ? 'location' : undefined} onClick={() => jump(item.id)}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{item.label}</button>)}</nav>
}
